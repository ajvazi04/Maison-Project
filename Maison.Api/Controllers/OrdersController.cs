using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Globalization;
using Maison.Api.Data;
using Maison.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController(MaisonDbContext db) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("orders")]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count is < 1 or > 50)
            return BadRequest(new { message = "Porosia duhet të ketë nga 1 deri në 50 artikuj." });
        if (!ShippingRates.TryGetValue(request.Country, out var shipping))
            return BadRequest(new { message = "Shteti i dërgesës nuk mbështetet." });
        if (!CitiesByCountry[request.Country].Contains(request.City.Trim()))
            return BadRequest(new { message = "Qyteti nuk i përket shtetit të zgjedhur." });
        if (!IsPhoneValid(request.Phone, request.Country))
            return BadRequest(new { message = "Numri i telefonit nuk është i vlefshëm për shtetin e zgjedhur." });

        var productIds = request.Items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await db.Products
            .Where(product => productIds.Contains(product.Id) && product.IsActive)
            .ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != productIds.Length)
            return BadRequest(new { message = "Një ose më shumë produkte nuk janë më në dispozicion." });

        var orderItems = new List<OrderItem>();
        decimal subtotal = 0;
        foreach (var item in request.Items)
        {
            if (item.Quantity is < 1 or > 20)
                return BadRequest(new { message = "Sasia për artikull duhet të jetë nga 1 deri në 20." });

            var product = products[item.ProductId];
            var sizes = System.Text.Json.JsonSerializer.Deserialize<string[]>(product.SizesJson) ?? [];
            var colors = System.Text.Json.JsonSerializer.Deserialize<string[]>(product.ColorsJson) ?? [];
            if (!sizes.Contains(item.Size, StringComparer.Ordinal) ||
                !colors.Contains(item.Color, StringComparer.Ordinal))
                return BadRequest(new { message = $"Madhësia ose ngjyra nuk është e vlefshme për {product.Name}." });

            var unitPrice = product.SalePrice ?? product.Price;
            var lineTotal = decimal.Round(unitPrice * item.Quantity, 2, MidpointRounding.AwayFromZero);
            subtotal += lineTotal;
            orderItems.Add(new OrderItem
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Size = item.Size,
                Color = item.Color,
                Quantity = item.Quantity,
                UnitPrice = unitPrice,
                LineTotal = lineTotal
            });
        }

        subtotal = decimal.Round(subtotal, 2, MidpointRounding.AwayFromZero);
        var discount = 0m;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            if (!string.Equals(request.CouponCode.Trim(), "SUMMER30", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Kodi i kuponit nuk ekziston." });
            if (subtotal < 50m)
                return BadRequest(new { message = "Kuponi SUMMER30 kërkon porosi minimale prej €50." });
            discount = decimal.Round(subtotal * 0.30m, 2, MidpointRounding.AwayFromZero);
        }

        var order = new CustomerOrder
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Country = request.Country,
            City = request.City.Trim(),
            Address = request.Address.Trim(),
            PostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim(),
            PaymentMethod = "CashOnDelivery",
            Status = "Received",
            Subtotal = subtotal,
            Discount = discount,
            Shipping = shipping,
            Total = subtotal - discount + shipping,
            CreatedAtUtc = DateTime.UtcNow,
            Items = orderItems
        };

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        foreach (var item in request.Items)
        {
            var updated = await db.Products
                .Where(product => product.Id == item.ProductId && product.IsActive && product.Stock >= item.Quantity)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(product => product.Stock, product => product.Stock - item.Quantity),
                    cancellationToken);
            if (updated != 1)
                return Conflict(new { message = "Stoku ndryshoi ose nuk ka sasi të mjaftueshme. Rifresko shportën dhe provo përsëri." });
        }

        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new
        {
            orderNumber = $"MAS-{order.Id:D6}",
            status = order.Status,
            subtotal = order.Subtotal,
            discount = order.Discount,
            shipping = order.Shipping,
            total = order.Total,
            currency = "EUR"
        });
    }

    [HttpPost("track")]
    [EnableRateLimiting("orders")]
    public async Task<IActionResult> TrackOrder(
        [FromBody] TrackOrderRequest request,
        CancellationToken cancellationToken)
    {
        var firstName = request.FirstName.Trim();
        var lastName = request.LastName.Trim();
        var email = request.Email.Trim().ToLowerInvariant();
        var matchingEmailOrders = await db.Orders.AsNoTracking()
            .Where(order => order.Email == email)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Include(order => order.Items)
            .ToListAsync(cancellationToken);
        var orders = matchingEmailOrders
            .Where(order =>
                string.Equals(order.FirstName, firstName, StringComparison.OrdinalIgnoreCase) &&
                string.Equals(order.LastName, lastName, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (orders.Count == 0)
            return NotFound(new { message = "Porosia nuk u gjet. Kontrollo emrin, mbiemrin dhe email-in." });

        return Ok(orders.Select(order => new
        {
            orderNumber = $"MAS-{order.Id:D6}",
            order.FirstName,
            order.LastName,
            status = order.Status,
            createdAtUtc = order.CreatedAtUtc,
            total = order.Total,
            items = order.Items.Select(item => new
            {
                item.ProductName,
                item.Size,
                item.Color,
                item.Quantity
            })
        }));
    }

    [HttpPost("{orderNumber}/cancel")]
    [EnableRateLimiting("orders")]
    public async Task<IActionResult> CancelOrder(
        string orderNumber,
        [FromBody] CancelOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetOrderId(orderNumber, out var orderId))
            return NotFound(new { message = "Porosia nuk u gjet. Kontrollo numrin dhe email-in." });

        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);
        var order = await db.Orders.Include(candidate => candidate.Items)
            .FirstOrDefaultAsync(candidate =>
                candidate.Id == orderId &&
                candidate.Email == request.Email.Trim().ToLowerInvariant(),
                cancellationToken);
        if (order is null)
            return NotFound(new { message = "Porosia nuk u gjet. Kontrollo numrin dhe email-in." });
        if (order.Status != "Received")
            return Conflict(new
            {
                message = "Porosia nuk mund të anulohet pasi është konfirmuar ose ka kaluar në përpunim."
            });
        if (order.PaymentMethod == "PayPal")
            return Conflict(new
            {
                message = "Porosia e paguar me PayPal nuk mund të anulohet këtu. Kontakto Maison për rimbursim."
            });

        foreach (var item in order.Items.GroupBy(item => item.ProductId))
        {
            var quantity = item.Sum(orderItem => orderItem.Quantity);
            var updated = await db.Products
                .Where(product => product.Id == item.Key)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        product => product.Stock, product => product.Stock + quantity),
                    cancellationToken);
            if (updated != 1)
                return Conflict(new { message = "Stoku nuk mund të rikthehet për këtë porosi." });
        }

        order.Status = "Cancelled";
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(new { orderNumber = $"MAS-{order.Id:D6}", status = order.Status });
    }

    private static bool TryGetOrderId(string orderNumber, out long orderId)
    {
        orderId = 0;
        return orderNumber.StartsWith("MAS-", StringComparison.Ordinal) &&
            long.TryParse(orderNumber.AsSpan(4), NumberStyles.None, CultureInfo.InvariantCulture, out orderId) &&
            orderId > 0;
    }

    internal static readonly Dictionary<string, decimal> ShippingRates = new(StringComparer.Ordinal)
    {
        ["XK"] = 2.50m,
        ["AL"] = 4m,
        ["MK"] = 4m
    };

    internal static readonly Dictionary<string, string> PhonePrefixes = new(StringComparer.Ordinal)
    {
        ["XK"] = "+383",
        ["AL"] = "+355",
        ["MK"] = "+389"
    };

    internal static readonly Dictionary<string, int> PhoneNumberLengths = new(StringComparer.Ordinal)
    {
        ["XK"] = 8,
        ["AL"] = 9,
        ["MK"] = 8
    };

    internal static bool IsPhoneValid(string phone, string country)
    {
        if (!PhonePrefixes.TryGetValue(country, out var prefix) ||
            !PhoneNumberLengths.TryGetValue(country, out var numberLength) ||
            !phone.StartsWith(prefix, StringComparison.Ordinal))
            return false;

        var nationalNumber = phone[prefix.Length..];
        return nationalNumber.Length == numberLength &&
            nationalNumber.All(char.IsAsciiDigit);
    }

    internal static readonly Dictionary<string, HashSet<string>> CitiesByCountry = new(StringComparer.Ordinal)
    {
        ["XK"] = new(StringComparer.OrdinalIgnoreCase)
        {
            "Deçan", "Dragash", "Drenas", "Ferizaj", "Fushë Kosovë", "Gjakovë", "Gjilan",
            "Graçanicë", "Hani i Elezit", "Istog", "Junik", "Kaçanik", "Kamenicë",
            "Klinë", "Kllokot", "Leposaviq", "Lipjan", "Malishevë", "Mamushë",
            "Mitrovicë e Jugut", "Mitrovicë e Veriut", "Novobërdë", "Obiliq", "Pejë",
            "Besjanë", "Podujevë", "Prishtinë", "Prizren", "Rahovec", "Ranillug", "Shtërpcë",
            "Shtime", "Skenderaj", "Suharekë", "Viti", "Vushtrri", "Zubin Potok",
            "Zveçan", "Partesh"
        },
        ["AL"] = new(StringComparer.OrdinalIgnoreCase)
        {
            "Berat", "Kuçovë", "Skrapar", "Dimal", "Poliçan", "Shkodër",
            "Malësi e Madhe", "Vau i Dejës", "Pukë", "Fushë-Arrëz", "Lezhë",
            "Mirditë", "Kurbin", "Dibër", "Bulqizë", "Mat", "Klos", "Durrës",
            "Shijak", "Krujë", "Tiranë", "Kamëz", "Vorë", "Kavajë", "Rrogozhinë",
            "Elbasan", "Cërrik", "Belsh", "Gramsh", "Librazhd", "Peqin", "Fier",
            "Lushnjë", "Divjakë", "Mallakastër", "Patos", "Roskovec", "Vlorë",
            "Himarë", "Selenicë", "Sarandë", "Konispol", "Finiq", "Delvinë",
            "Gjirokastër", "Dropull", "Libohovë", "Tepelenë", "Përmet", "Këlcyrë",
            "Memaliaj", "Korçë", "Pogradec", "Devoll", "Kolonjë", "Maliq", "Pustec",
            "Kukës", "Has", "Tropojë", "Prrenjas"
        },
        ["MK"] = new(StringComparer.OrdinalIgnoreCase)
        {
            "Aerodrom", "Araçinovë", "Haraçinë", "Berovë", "Manastir", "Bogdancë", "Bogovinë",
            "Bosilovë", "Brvenicë", "Butel", "Vallandovë", "Vasilevë", "Vevçan",
            "Veles", "Vinicë", "Vrapçisht", "Gazi Babë", "Gjevgjeli", "Gostivar",
            "Gradsko", "Dibër", "Debarcë", "Dellçevë", "Demir Hisar", "Demir Kapi", "Dojran",
            "Dollnen", "Gjorçe Petrov", "Zhelinë", "Zelenikovë", "Zërnovc", "Ilinden",
            "Jegunovcë", "Karbinci", "Karposh", "Kisella Vodë", "Kërçovë", "Konçe",
            "Koçan", "Kratovë", "Kriva Pallankë", "Krivogashtan", "Kruševo", "Kumanovë",
            "Lipkovë", "Lozovë", "Makedonska Kamenicë", "Makedonski Brod",
            "Mavrovë dhe Rostushë", "Mogillë", "Negotinë", "Novaci", "Novo Sellë", "Oslomej",
            "Ohrid", "Petrovec", "Pehçevë", "Plasnicë", "Prilep", "Probishtip",
            "Radovish", "Rankovcë", "Resnjë", "Rosoman", "Saraj", "Sveti Nikollë",
            "Sopište", "Staro Nagoriçanë", "Strugë", "Strumicë", "Studeniçan",
            "Tearcë", "Tetovë", "Qendër", "Qendër Zhupë", "Çashkë",
            "Çeshinovë-Obleshevë", "Çuçer-Sandevë", "Shtip", "Shuto Orizari",
            "Shkup"
        }
    };
}

public sealed class CreateOrderRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public required string FirstName { get; init; }

    [Required, StringLength(80, MinimumLength = 1)]
    public required string LastName { get; init; }

    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, Phone, StringLength(40, MinimumLength = 5)]
    public required string Phone { get; init; }

    [Required, RegularExpression("^(XK|AL|MK)$")]
    public required string Country { get; init; }

    [Required, StringLength(100, MinimumLength = 1)]
    public required string City { get; init; }

    [Required, StringLength(200, MinimumLength = 1)]
    public required string Address { get; init; }

    [StringLength(20)]
    public string? PostalCode { get; init; }

    [StringLength(40)]
    public string? CouponCode { get; init; }

    [Required, MinLength(1), MaxLength(50)]
    public required List<CreateOrderItemRequest> Items { get; init; }
}

public sealed class CreateOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; init; }

    [Required, StringLength(40)]
    public required string Size { get; init; }

    [Required, StringLength(40)]
    public required string Color { get; init; }

    [Range(1, 20)]
    public int Quantity { get; init; }
}

public sealed class TrackOrderRequest
{
    [Required, StringLength(80, MinimumLength = 1)]
    public required string FirstName { get; init; }

    [Required, StringLength(80, MinimumLength = 1)]
    public required string LastName { get; init; }

    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }
}

public sealed class CancelOrderRequest
{
    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }
}
