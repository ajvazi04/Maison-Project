using System.Threading.RateLimiting;
using Maison.Api.Data;
using Maison.Api.Models;
using Maison.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("MaisonDb")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__MaisonDb")
    ?? $"Data Source={Path.Combine(builder.Environment.ContentRootPath, "maison.db")}";
builder.Services.AddDbContext<MaisonDbContext>(options => options.UseSqlite(connectionString));
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    Directory.CreateDirectory(dataProtectionKeysPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
        .SetApplicationName("Maison");
}
var trustedProxy = builder.Configuration["ReverseProxy:TrustedProxy"];
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (IPAddress.TryParse(trustedProxy, out var proxyAddress))
        options.KnownProxies.Add(proxyAddress);
});
builder.Services.AddHttpClient("Payments", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<IPasswordHasher<CustomerAccount>, PasswordHasher<CustomerAccount>>();
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "maison.admin";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ||
            builder.Configuration.GetValue<bool>("LocalApp:AllowHttpCookies")
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy =>
{
    policy.WithOrigins(
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5173",
            "http://127.0.0.1:5173");
    if (builder.Environment.IsDevelopment())
    {
        policy.SetIsOriginAllowed(IsAllowedDevelopmentOrigin);
    }
    policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
}));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("orders", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("admin-login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("account-auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy("feedback", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
var indexFile = Path.Combine(app.Environment.WebRootPath, "index.html");
var hasFrontend = File.Exists(indexFile);
if (hasFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
if (hasFrontend)
{
    app.MapFallback(async context =>
    {
        if (context.Request.Path.StartsWithSegments("/api") ||
            Path.HasExtension(context.Request.Path.Value))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(indexFile);
    }).ExcludeFromDescription();
}

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MaisonDbContext>();
    await SeedData.InitializeAsync(db);
}

app.Run();

static bool IsAllowedDevelopmentOrigin(string origin)
{
    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) ||
        uri.Scheme != Uri.UriSchemeHttp ||
        uri.Port is not (4173 or 5173))
        return false;

    if (uri.IsLoopback)
        return true;
    if (!IPAddress.TryParse(uri.Host, out var address) ||
        address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
        return false;

    var bytes = address.GetAddressBytes();
    return bytes[0] == 10 ||
        bytes[0] == 192 && bytes[1] == 168 ||
        bytes[0] == 172 && bytes[1] is >= 16 and <= 31;
}
