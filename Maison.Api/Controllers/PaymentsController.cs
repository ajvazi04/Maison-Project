using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Maison.Api.Data;
using Maison.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api/payments")]
public sealed class PaymentsController(
    MaisonDbContext db,
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<PaymentsController> logger) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("options")]
    public IActionResult GetPaymentOptions()
    {
        var clientId = configuration["Payments:PayPal:ClientId"];
        var secret = configuration["Payments:PayPal:Secret"];
        return Ok(new
        {
            cashOnDelivery = true,
            paypal = !string.IsNullOrWhiteSpace(clientId) && !string.IsNullOrWhiteSpace(secret),
            paypalClientId = !string.IsNullOrWhiteSpace(secret) ? clientId : null,
            bankCard = false
        });
    }

    [HttpPost("paypal/create-order")]
    [EnableRateLimiting("orders")]
    public async Task<IActionResult> CreatePayPalOrder(
        [FromBody] CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetPayPalCredentials(out var clientId, out var secret, out var apiBase))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Pagesa me PayPal nuk është konfiguruar ende." });

        var quoteResult = await CreateOrderDraftAsync(request, cancellationToken);
        if (quoteResult.Error is not null)
            return BadRequest(new { message = quoteResult.Error });

        var draft = quoteResult.Order!;
        var attemptId = Guid.NewGuid();
        await db.PaymentAttempts
            .Where(attempt => attempt.Status == "Pending" &&
                attempt.CreatedAtUtc < DateTime.UtcNow.AddHours(-2))
            .ExecuteDeleteAsync(cancellationToken);
        var origin = configuration["Payments:FrontendBaseUrl"]?.TrimEnd('/')
            ?? "http://localhost:4173";
        var paypalOrderRequest = new
        {
            intent = "CAPTURE",
            purchase_units = new[]
            {
                new
                {
                    custom_id = attemptId.ToString("N"),
                    amount = new
                    {
                        currency_code = "EUR",
                        value = draft.Total.ToString("0.00", CultureInfo.InvariantCulture)
                    }
                }
            },
            application_context = new
            {
                brand_name = "Maison",
                user_action = "PAY_NOW",
                return_url = $"{origin}/payment-return?attempt={attemptId:N}",
                cancel_url = $"{origin}/checkout?payment=cancelled"
            }
        };

        try
        {
            var accessToken = await GetPayPalAccessTokenAsync(
                clientId, secret, apiBase, cancellationToken);
            using var response = await SendPayPalAsync(
                HttpMethod.Post,
                $"{apiBase}/v2/checkout/orders",
                accessToken,
                paypalOrderRequest,
                cancellationToken);
            using var responseJson = await JsonDocument.ParseAsync(
                await response.Content.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("PayPal order creation failed with status {StatusCode}.",
                    (int)response.StatusCode);
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { message = "PayPal nuk mundi ta përgatisë pagesën. Provo përsëri." });
            }

            var providerOrderId = responseJson.RootElement.TryGetProperty("id", out var idElement)
                ? idElement.GetString()
                : null;
            var approvalLink = responseJson.RootElement.TryGetProperty("links", out var links)
                ? links.EnumerateArray().FirstOrDefault(link =>
                    link.TryGetProperty("rel", out var relation) &&
                    relation.GetString() == "approve")
                : default;
            var approvalUrl = approvalLink.ValueKind == JsonValueKind.Undefined
                ? null
                : approvalLink.GetProperty("href").GetString();
            if (string.IsNullOrWhiteSpace(providerOrderId) ||
                string.IsNullOrWhiteSpace(approvalUrl))
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { message = "PayPal ktheu përgjigje të pavlefshme." });

            db.PaymentAttempts.Add(new PaymentAttempt
            {
                Id = attemptId,
                Provider = "PayPal",
                ProviderOrderId = providerOrderId,
                OrderJson = JsonSerializer.Serialize(draft, JsonOptions),
                Status = "Pending",
                Total = draft.Total,
                CreatedAtUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new { approvalUrl });
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Could not connect to PayPal while creating an order.");
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "Nuk mund të lidhemi me PayPal. Provo përsëri." });
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "PayPal timed out while creating an order.");
            return StatusCode(StatusCodes.Status504GatewayTimeout,
                new { message = "PayPal nuk u përgjigj në kohë. Provo përsëri." });
        }
    }

    [HttpPost("paypal/capture")]
    [EnableRateLimiting("orders")]
    public async Task<IActionResult> CapturePayPalOrder(
        [FromBody] CapturePayPalRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetPayPalCredentials(out var clientId, out var secret, out var apiBase))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Pagesa me PayPal nuk është konfiguruar ende." });

        if (!Guid.TryParseExact(request.AttemptId, "N", out var attemptId))
            return BadRequest(new { message = "Sesioni i pagesës nuk është i vlefshëm." });

        var attempt = await db.PaymentAttempts.FirstOrDefaultAsync(
            candidate => candidate.Id == attemptId &&
                candidate.Provider == "PayPal" &&
                candidate.ProviderOrderId == request.PayPalOrderId,
            cancellationToken);
        if (attempt is null)
            return NotFound(new { message = "Pagesa nuk u gjet ose ka skaduar." });
        if (attempt.Status == "Completed" && attempt.CustomerOrderId is not null)
        {
            var completedOrder = await db.Orders.AsNoTracking().FirstAsync(
                order => order.Id == attempt.CustomerOrderId,
                cancellationToken);
            return Ok(TrackingResponse(completedOrder));
        }
        if (attempt.Status != "Pending" ||
            attempt.CreatedAtUtc < DateTime.UtcNow.AddHours(-2))
            return Conflict(new { message = "Sesioni i pagesës ka skaduar. Kthehu te shporta dhe provo përsëri." });

        CustomerOrder? draft;
        try
        {
            draft = JsonSerializer.Deserialize<CustomerOrder>(attempt.OrderJson, JsonOptions);
        }
        catch (JsonException exception)
        {
            logger.LogError(exception, "Saved PayPal order draft {AttemptId} is invalid.", attempt.Id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "Të dhënat e porosisë nuk mund të lexohen." });
        }
        if (draft is null || draft.Total != attempt.Total)
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { message = "Totali i pagesës nuk përputhet me porosinë." });

        try
        {
            var accessToken = await GetPayPalAccessTokenAsync(
                clientId, secret, apiBase, cancellationToken);
            using var orderResponse = await SendPayPalAsync(
                HttpMethod.Get,
                $"{apiBase}/v2/checkout/orders/{Uri.EscapeDataString(attempt.ProviderOrderId)}",
                accessToken,
                body: null,
                cancellationToken);
            using var orderJson = await JsonDocument.ParseAsync(
                await orderResponse.Content.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            if (!orderResponse.IsSuccessStatusCode)
            {
                logger.LogWarning("PayPal order verification failed with status {StatusCode}.",
                    (int)orderResponse.StatusCode);
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { message = "PayPal nuk mundi ta verifikojë pagesën." });
            }
            if (orderJson.RootElement.GetProperty("id").GetString() != attempt.ProviderOrderId)
                return StatusCode(StatusCodes.Status502BadGateway,
                    new { message = "PayPal ktheu një porosi tjetër nga ajo e pritur." });

            var providerStatus = orderJson.RootElement.GetProperty("status").GetString();
            JsonDocument captureJson;
            if (providerStatus == "COMPLETED")
            {
                captureJson = orderJson;
            }
            else if (providerStatus == "APPROVED")
            {
                var captureResponse = await SendPayPalAsync(
                    HttpMethod.Post,
                    $"{apiBase}/v2/checkout/orders/{Uri.EscapeDataString(attempt.ProviderOrderId)}/capture",
                    accessToken,
                    new { },
                    cancellationToken);
                using (captureResponse)
                {
                    captureJson = await JsonDocument.ParseAsync(
                        await captureResponse.Content.ReadAsStreamAsync(cancellationToken),
                        cancellationToken: cancellationToken);
                }
            }
            else
            {
                return Conflict(new { message = "Pagesa nuk është aprovuar në PayPal." });
            }

            using (captureJson)
            {
                if (!captureJson.RootElement.TryGetProperty("purchase_units", out var purchaseUnits) ||
                    purchaseUnits.GetArrayLength() != 1)
                    return StatusCode(StatusCodes.Status502BadGateway,
                        new { message = "PayPal nuk ktheu detajet e pritshme të pagesës." });

                var purchaseUnit = purchaseUnits[0];
                var customId = purchaseUnit.TryGetProperty("custom_id", out var customIdElement)
                    ? customIdElement.GetString()
                    : null;
                if (customId != attempt.Id.ToString("N") ||
                    !purchaseUnit.TryGetProperty("payments", out var payments) ||
                    !payments.TryGetProperty("captures", out var captures) ||
                    captures.GetArrayLength() != 1)
                    return StatusCode(StatusCodes.Status502BadGateway,
                        new { message = "Pagesa nuk përputhet me porosinë." });

                var capture = captures[0];
                var captureStatus = capture.GetProperty("status").GetString();
                var amount = capture.GetProperty("amount");
                var currency = amount.GetProperty("currency_code").GetString();
                var paidAmount = decimal.Parse(
                    amount.GetProperty("value").GetString()!,
                    CultureInfo.InvariantCulture);
                var captureId = capture.TryGetProperty("id", out var captureIdElement)
                    ? captureIdElement.GetString()
                    : null;
                if (captureStatus != "COMPLETED" ||
                    currency != "EUR" ||
                    paidAmount != attempt.Total)
                    return StatusCode(StatusCodes.Status502BadGateway,
                        new { message = "PayPal nuk e konfirmoi shumën e plotë të porosisë." });
                if (string.IsNullOrWhiteSpace(captureId))
                    return StatusCode(StatusCodes.Status502BadGateway,
                        new { message = "PayPal nuk ktheu numrin e konfirmimit të pagesës." });

                return await SavePaidOrderAsync(
                    attempt,
                    draft,
                    captureId,
                    clientId,
                    secret,
                    apiBase,
                    cancellationToken);
            }
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Could not connect to PayPal while capturing an order.");
            return StatusCode(StatusCodes.Status502BadGateway,
                new { message = "Nuk mund të verifikojmë pagesën me PayPal. Provo përsëri." });
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "PayPal timed out while capturing an order.");
            return StatusCode(StatusCodes.Status504GatewayTimeout,
                new { message = "PayPal nuk u përgjigj në kohë. Provo përsëri." });
        }
    }

    private async Task<IActionResult> SavePaidOrderAsync(
        PaymentAttempt attempt,
        CustomerOrder draft,
        string captureId,
        string clientId,
        string secret,
        string apiBase,
        CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);
        var currentAttempt = await db.PaymentAttempts.FirstAsync(
            candidate => candidate.Id == attempt.Id,
            cancellationToken);
        if (currentAttempt.Status == "Completed" && currentAttempt.CustomerOrderId is not null)
        {
            var existingOrder = await db.Orders.AsNoTracking().FirstAsync(
                order => order.Id == currentAttempt.CustomerOrderId,
                cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Ok(TrackingResponse(existingOrder));
        }

        foreach (var item in draft.Items.GroupBy(item => item.ProductId))
        {
            var quantity = item.Sum(orderItem => orderItem.Quantity);
            var updated = await db.Products
                .Where(product => product.Id == item.Key &&
                    product.IsActive &&
                    product.Stock >= quantity)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        product => product.Stock,
                        product => product.Stock - quantity),
                    cancellationToken);
            if (updated != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                var refunded = await TryRefundPayPalCaptureAsync(
                    captureId, clientId, secret, apiBase, cancellationToken);
                logger.LogWarning(
                    "PayPal capture {CaptureId} was refunded after inventory changed: {Refunded}.",
                    captureId,
                    refunded);
                return Conflict(new
                {
                    message = refunded
                        ? "Stoku mbaroi gjatë pagesës; shuma u kthye përmes PayPal."
                        : "Pagesa u krye, por stoku ndryshoi. Kontakto Maison për rimbursim."
                });
            }
        }

        draft.CreatedAtUtc = DateTime.UtcNow;
        db.Orders.Add(draft);
        currentAttempt.Status = "Completed";
        currentAttempt.CustomerOrderId = draft.Id;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogError(exception, "Could not persist paid PayPal order {AttemptId}.", attempt.Id);
            var refunded = await TryRefundPayPalCaptureAsync(
                captureId, clientId, secret, apiBase, cancellationToken);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new
                {
                    message = refunded
                        ? "Pagesa u kthye sepse porosia nuk mund të regjistrohej. Provo përsëri."
                        : "Pagesa u krye, por porosia nuk u regjistrua. Kontakto Maison për rimbursim."
                });
        }
        await transaction.CommitAsync(cancellationToken);
        return Ok(TrackingResponse(draft));
    }

    private async Task<(CustomerOrder? Order, string? Error)> CreateOrderDraftAsync(
        CreateOrderRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Items.Count is < 1 or > 50)
            return (null, "Porosia duhet të ketë nga 1 deri në 50 artikuj.");
        if (!OrdersController.ShippingRates.TryGetValue(request.Country, out var shipping))
            return (null, "Shteti i dërgesës nuk mbështetet.");
        if (!OrdersController.CitiesByCountry[request.Country].Contains(request.City.Trim()))
            return (null, "Qyteti nuk i përket shtetit të zgjedhur.");
        if (!OrdersController.IsPhoneValid(request.Phone, request.Country))
            return (null, "Numri i telefonit nuk është i vlefshëm për shtetin e zgjedhur.");

        var productIds = request.Items.Select(item => item.ProductId).Distinct().ToArray();
        var products = await db.Products
            .Where(product => productIds.Contains(product.Id) && product.IsActive)
            .ToDictionaryAsync(product => product.Id, cancellationToken);
        if (products.Count != productIds.Length)
            return (null, "Një ose më shumë produkte nuk janë më në dispozicion.");

        var orderItems = new List<OrderItem>();
        decimal subtotal = 0;
        foreach (var item in request.Items)
        {
            if (item.Quantity is < 1 or > 20)
                return (null, "Sasia për artikull duhet të jetë nga 1 deri në 20.");

            var product = products[item.ProductId];
            var sizes = JsonSerializer.Deserialize<string[]>(product.SizesJson) ?? [];
            var colors = JsonSerializer.Deserialize<string[]>(product.ColorsJson) ?? [];
            if (!sizes.Contains(item.Size, StringComparer.Ordinal) ||
                !colors.Contains(item.Color, StringComparer.Ordinal))
                return (null, $"Madhësia ose ngjyra nuk është e vlefshme për {product.Name}.");

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

        foreach (var item in orderItems.GroupBy(item => item.ProductId))
            if (products[item.Key].Stock < item.Sum(orderItem => orderItem.Quantity))
                return (null, $"Nuk ka stok të mjaftueshëm për {products[item.Key].Name}.");

        subtotal = decimal.Round(subtotal, 2, MidpointRounding.AwayFromZero);
        var discount = 0m;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            if (!string.Equals(request.CouponCode.Trim(), "SUMMER30", StringComparison.OrdinalIgnoreCase))
                return (null, "Kodi i kuponit nuk ekziston.");
            if (subtotal < 50m)
                return (null, "Kuponi SUMMER30 kërkon porosi minimale prej €50.");
            discount = decimal.Round(subtotal * 0.30m, 2, MidpointRounding.AwayFromZero);
        }

        return (new CustomerOrder
        {
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone.Trim(),
            Country = request.Country,
            City = request.City.Trim(),
            Address = request.Address.Trim(),
            PostalCode = string.IsNullOrWhiteSpace(request.PostalCode) ? null : request.PostalCode.Trim(),
            PaymentMethod = "PayPal",
            Status = "Received",
            Subtotal = subtotal,
            Discount = discount,
            Shipping = shipping,
            Total = subtotal - discount + shipping,
            CreatedAtUtc = DateTime.UtcNow,
            Items = orderItems
        }, null);
    }

    private async Task<string> GetPayPalAccessTokenAsync(
        string clientId,
        string secret,
        string apiBase,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{apiBase}/v1/oauth2/token");
        request.Headers.Authorization = new AuthenticationHeaderValue(
            "Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{secret}")));
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials"
        });
        using var response = await httpClientFactory.CreateClient("Payments")
            .SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("PayPal token request failed with status {StatusCode}.",
                (int)response.StatusCode);
            throw new HttpRequestException("PayPal OAuth token request failed.");
        }

        using var json = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellationToken),
            cancellationToken: cancellationToken);
        return json.RootElement.GetProperty("access_token").GetString()
            ?? throw new HttpRequestException("PayPal returned an empty access token.");
    }

    private async Task<HttpResponseMessage> SendPayPalAsync(
        HttpMethod method,
        string url,
        string accessToken,
        object? body,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        if (body is not null)
            request.Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOptions),
                Encoding.UTF8,
                "application/json");
        return await httpClientFactory.CreateClient("Payments")
            .SendAsync(request, cancellationToken);
    }

    private async Task<bool> TryRefundPayPalCaptureAsync(
        string captureId,
        string clientId,
        string secret,
        string apiBase,
        CancellationToken cancellationToken)
    {
        try
        {
            var accessToken = await GetPayPalAccessTokenAsync(
                clientId, secret, apiBase, cancellationToken);
            using var response = await SendPayPalAsync(
                HttpMethod.Post,
                $"{apiBase}/v2/payments/captures/{Uri.EscapeDataString(captureId)}/refund",
                accessToken,
                new { },
                cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Automatic PayPal refund failed for capture {CaptureId}.", captureId);
            return false;
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "Automatic PayPal refund timed out for capture {CaptureId}.", captureId);
            return false;
        }
    }

    private bool TryGetPayPalCredentials(
        out string clientId,
        out string secret,
        out string apiBase)
    {
        clientId = configuration["Payments:PayPal:ClientId"] ?? "";
        secret = configuration["Payments:PayPal:Secret"] ?? "";
        var mode = configuration["Payments:PayPal:Mode"] ?? "Sandbox";
        apiBase = string.Equals(mode, "Live", StringComparison.OrdinalIgnoreCase)
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
        return !string.IsNullOrWhiteSpace(clientId) &&
            !string.IsNullOrWhiteSpace(secret) &&
            (string.Equals(mode, "Live", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(mode, "Sandbox", StringComparison.OrdinalIgnoreCase));
    }

    private static object TrackingResponse(CustomerOrder order) => new
    {
        firstName = order.FirstName,
        lastName = order.LastName,
        email = order.Email,
        message = "Pagesa u konfirmua dhe porosia u regjistrua."
    };
}

public sealed class CapturePayPalRequest
{
    [Required, StringLength(32, MinimumLength = 32)]
    public required string AttemptId { get; init; }

    [Required, StringLength(64, MinimumLength = 1)]
    public required string PayPalOrderId { get; init; }
}
