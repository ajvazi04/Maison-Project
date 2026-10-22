using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Maison.Api.Data;
using Maison.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api/admin")]
public sealed class AdminController(MaisonDbContext db, IConfiguration configuration) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting("admin-login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest request)
    {
        var username = configuration["ADMIN_USERNAME"];
        var password = configuration["ADMIN_PASSWORD"];
        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Hyrja e administratorit nuk është konfiguruar në server." });

        if (!FixedTimeEquals(request.Username, username) || !FixedTimeEquals(request.Password, password))
            return Unauthorized(new { message = "Emri i përdoruesit ose fjalëkalimi nuk është i saktë." });

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, "Admin")
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            claims, CookieAuthenticationDefaults.AuthenticationScheme));
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                AllowRefresh = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("orders/week")]
    public async Task<IActionResult> GetOrdersThisWeek(
        [FromQuery] DateTimeOffset fromUtc,
        [FromQuery] DateTimeOffset toUtc,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        CancellationToken cancellationToken = default)
    {
        if (toUtc <= fromUtc || toUtc - fromUtc > TimeSpan.FromDays(8))
            return BadRequest(new { message = "Intervali i javës nuk është i vlefshëm." });

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var start = fromUtc.UtcDateTime;
        var end = toUtc.UtcDateTime;
        var query = db.Orders.AsNoTracking()
            .Where(order => !order.IsArchived &&
                order.CreatedAtUtc >= start && order.CreatedAtUtc < end);
        var totalCount = await query.CountAsync(cancellationToken);
        var weeklyTotal = await query
            .Where(order => order.Status != "Cancelled")
            .Select(order => (decimal?)order.Total)
            .SumAsync(cancellationToken) ?? 0m;
        var orders = await query
            .OrderByDescending(order => order.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(order => order.Items)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            totalCount,
            weeklyTotal,
            page,
            pageSize,
            orders = orders.Select(order => new
            {
                orderNumber = $"MAS-{order.Id:D6}",
                order.FirstName,
                order.LastName,
                order.Email,
                order.Phone,
                order.Country,
                order.City,
                order.Address,
                order.PostalCode,
                order.PaymentMethod,
                order.Status,
                order.Subtotal,
                order.Discount,
                order.Shipping,
                order.Total,
                order.CreatedAtUtc,
                items = order.Items.Select(item => new
                {
                    item.ProductId,
                    item.ProductName,
                    item.Size,
                    item.Color,
                    item.Quantity,
                    item.UnitPrice,
                    item.LineTotal
                })
            })
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("contact-messages")]
    public async Task<IActionResult> GetContactMessages(CancellationToken cancellationToken)
    {
        var messages = await db.ContactMessages.AsNoTracking()
            .OrderByDescending(message => message.Id)
            .Take(100)
            .Select(message => new
            {
                message.Id,
                message.Name,
                message.Email,
                message.Message,
                message.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);
        return Ok(messages);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var orders = await db.Orders.AsNoTracking()
            .Where(order => !order.IsArchived)
            .OrderByDescending(order => order.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(order => order.Items)
            .ToListAsync(cancellationToken);
        return Ok(orders.Select(order => new
        {
            orderNumber = $"MAS-{order.Id:D6}",
            order.FirstName,
            order.LastName,
            order.Email,
            order.Phone,
            order.Country,
            order.City,
            order.Address,
            order.PostalCode,
            order.PaymentMethod,
            order.Status,
            order.Subtotal,
            order.Discount,
            order.Shipping,
            order.Total,
            order.CreatedAtUtc,
            items = order.Items.Select(item => new
            {
                item.ProductId,
                item.ProductName,
                item.Size,
                item.Color,
                item.Quantity,
                item.UnitPrice,
                item.LineTotal
            })
        }));
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("orders/{id:long}/status")]
    public async Task<IActionResult> UpdateOrderStatus(
        long id,
        [FromBody] UpdateOrderStatusRequest request,
        CancellationToken cancellationToken)
    {
        var allowedStatuses = new[] { "Received", "Confirmed", "SentToCourier", "Delivered", "Cancelled" };
        if (!allowedStatuses.Contains(request.Status, StringComparer.Ordinal))
            return BadRequest(new { message = "Statusi i porosisë nuk është i vlefshëm." });

        var order = await db.Orders.Include(order => order.Items)
            .FirstOrDefaultAsync(order => order.Id == id, cancellationToken);
        if (order is null)
            return NotFound(new { message = "Porosia nuk u gjet." });
        if (order.IsArchived)
            return Conflict(new { message = "Porosia është arkivuar dhe nuk mund të ndryshohet." });
        if (request.Status == "Cancelled" && order.PaymentMethod == "PayPal")
            return Conflict(new
            {
                message = "Porosia e paguar me PayPal nuk mund të anulohet këtu. Rimburso pagesën në PayPal para ndryshimit të statusit."
            });

        var allowedTransitions = new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["Received"] = ["Confirmed", "Cancelled"],
            ["Confirmed"] = ["SentToCourier", "Cancelled"],
            ["SentToCourier"] = ["Delivered"],
            ["Delivered"] = [],
            ["Cancelled"] = ["Received"]
        };
        if (order.Status != request.Status &&
            (!allowedTransitions.TryGetValue(order.Status, out var nextStatuses) ||
                !nextStatuses.Contains(request.Status, StringComparer.Ordinal)))
            return Conflict(new { message = "Kalimi i statusit të porosisë nuk lejohet." });

        await using var transaction = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, cancellationToken);
        if (order.Status != "Cancelled" && request.Status == "Cancelled")
        {
            foreach (var item in order.Items)
            {
                await db.Products
                    .Where(product => product.Id == item.ProductId)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            product => product.Stock, product => product.Stock + item.Quantity),
                        cancellationToken);
            }
        }
        else if (order.Status == "Cancelled" && request.Status != "Cancelled")
        {
            foreach (var item in order.Items)
            {
                var updated = await db.Products
                    .Where(product => product.Id == item.ProductId &&
                        product.IsActive && product.Stock >= item.Quantity)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(
                            product => product.Stock, product => product.Stock - item.Quantity),
                        cancellationToken);
                if (updated != 1)
                    return Conflict(new { message = "Nuk ka stok të mjaftueshëm për riaktivizimin e kësaj porosie." });
            }
        }

        order.Status = request.Status;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("orders/{id:long}/archive")]
    public async Task<IActionResult> ArchiveSentOrder(long id, CancellationToken cancellationToken)
    {
        var order = await db.Orders.FirstOrDefaultAsync(
            candidate => candidate.Id == id,
            cancellationToken);
        if (order is null)
            return NotFound(new { message = "Porosia nuk u gjet." });
        if (order.Status != "SentToCourier")
            return Conflict(new { message = "Vetëm porositë e dërguara te kurieri mund të arkivohen." });

        order.IsArchived = true;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(
        [FromBody] AdminProductRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Sale is not null && request.Sale >= request.Price)
            return BadRequest(new { message = "Çmimi promocional duhet të jetë më i ulët se çmimi bazë." });

        var product = MapProduct(new Product { Name = "", Category = "", Gender = "", Description = "", Image = "", SizesJson = "[]", ColorsJson = "[]" }, request);
        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/products/{product.Id}", new { id = product.Id });
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("products/{id:int}")]
    public async Task<IActionResult> UpdateProduct(
        int id,
        [FromBody] AdminProductRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Sale is not null && request.Sale >= request.Price)
            return BadRequest(new { message = "Çmimi promocional duhet të jetë më i ulët se çmimi bazë." });

        var product = await db.Products.FindAsync([id], cancellationToken);
        if (product is null)
            return NotFound(new { message = "Produkti nuk u gjet." });

        MapProduct(product, request);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FindAsync([id], cancellationToken);
        if (product is null)
            return NotFound(new { message = "Produkti nuk u gjet." });

        product.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static Product MapProduct(Product product, AdminProductRequest request)
    {
        product.Name = request.Name.Trim();
        product.Category = request.Category.Trim();
        product.Gender = string.IsNullOrWhiteSpace(request.Gender)
            ? product.Category switch
            {
                "Femra" or "Çanta" => "Femra",
                "Meshkuj" => "Meshkuj",
                _ => "Unisex"
            }
            : request.Gender.Trim();
        product.Price = request.Price;
        product.SalePrice = request.Sale;
        product.Description = request.Description.Trim();
        product.Image = request.Image.Trim();
        product.ColorsJson = JsonSerializer.Serialize(request.Colors);
        product.SizesJson = JsonSerializer.Serialize(request.Sizes);
        product.IsNew = request.IsNew;
        product.IsBestSeller = request.IsBestSeller;
        product.Stock = request.Stock;
        product.IsActive = true;
        return product;
    }

    private static bool FixedTimeEquals(string provided, string expected)
    {
        var providedBytes = Encoding.UTF8.GetBytes(provided);
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        return providedBytes.Length == expectedBytes.Length &&
            CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes);
    }
}

public sealed class AdminLoginRequest
{
    [Required, StringLength(100)]
    public required string Username { get; init; }

    [Required, StringLength(200)]
    public required string Password { get; init; }
}

public sealed class UpdateOrderStatusRequest
{
    [Required, StringLength(20)]
    public required string Status { get; init; }
}

public sealed class AdminProductRequest
{
    [Required, StringLength(120)]
    public required string Name { get; init; }

    [Required, StringLength(60)]
    public required string Category { get; init; }

    [Range(typeof(decimal), "0.01", "999999")]
    public decimal Price { get; init; }

    [Range(typeof(decimal), "0.01", "999999")]
    public decimal? Sale { get; init; }

    [Required, StringLength(1000)]
    public required string Description { get; init; }

    [Required, StringLength(300)]
    public required string Image { get; init; }

    [Required, MinLength(1), MaxLength(30)]
    public required string[] Colors { get; init; }

    [Required, MinLength(1), MaxLength(30)]
    public required string[] Sizes { get; init; }

    [Range(0, 100000)]
    public int Stock { get; init; }

    public bool IsNew { get; init; }

    [StringLength(20)]
    public string? Gender { get; init; }

    public bool IsBestSeller { get; init; }
}
