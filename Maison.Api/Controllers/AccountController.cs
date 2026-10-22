using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Maison.Api.Data;
using Maison.Api.Models;
using Maison.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api/account")]
public sealed class AccountController(
    MaisonDbContext db,
    IPasswordHasher<CustomerAccount> passwordHasher,
    IEmailSender emailSender,
    IConfiguration configuration,
    ILogger<AccountController> logger) : ControllerBase
{
    private static readonly TimeSpan PasswordResetLifetime = TimeSpan.FromMinutes(60);

    [HttpPost("register")]
    [EnableRateLimiting("account-auth")]
    public async Task<IActionResult> Register(
        [FromBody] RegisterAccountRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await db.CustomerAccounts.AnyAsync(account => account.Email == email, cancellationToken))
            return Conflict(new { message = "Ky email ka tashmë një llogari. Hyr në vend të regjistrimit." });

        var account = new CustomerAccount
        {
            Email = email,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            PasswordHash = "",
            CreatedAtUtc = DateTime.UtcNow
        };
        account.PasswordHash = passwordHasher.HashPassword(account, request.Password);
        db.CustomerAccounts.Add(account);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            return Conflict(new { message = "Ky email ka tashmë një llogari. Hyr në vend të regjistrimit." });
        }

        await SignInAsync(account);
        return Ok(ToResponse(account));
    }

    [HttpPost("login")]
    [EnableRateLimiting("account-auth")]
    public async Task<IActionResult> Login(
        [FromBody] LoginAccountRequest request,
        CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var account = await db.CustomerAccounts
            .FirstOrDefaultAsync(candidate => candidate.Email == email, cancellationToken);
        if (account is null ||
            passwordHasher.VerifyHashedPassword(account, account.PasswordHash, request.Password) ==
            PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Email-i ose fjalëkalimi nuk është i saktë." });

        await SignInAsync(account);
        return Ok(ToResponse(account));
    }

    [HttpPost("password-reset/request")]
    [EnableRateLimiting("account-auth")]
    public async Task<IActionResult> RequestPasswordReset(
        [FromBody] RequestPasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        if (!emailSender.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Rikthimi i fjalëkalimit nuk është konfiguruar ende në server." });

        var frontendBaseUrl = configuration["Email:FrontendBaseUrl"]?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(frontendBaseUrl) ||
            !Uri.TryCreate(frontendBaseUrl, UriKind.Absolute, out var frontendUri) ||
            frontendUri.Scheme != Uri.UriSchemeHttps && !frontendUri.IsLoopback)
        {
            logger.LogError("Password reset email has no valid HTTPS frontend URL configured.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Rikthimi i fjalëkalimit nuk është konfiguruar saktë." });
        }

        var email = request.Email.Trim().ToLowerInvariant();
        var account = await db.CustomerAccounts
            .FirstOrDefaultAsync(candidate => candidate.Email == email, cancellationToken);
        if (account is null)
            return Ok(PasswordResetRequestResponse());

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = DateTime.UtcNow;
        await db.PasswordResetTokens
            .Where(reset => reset.CustomerAccountId == account.Id)
            .ExecuteDeleteAsync(cancellationToken);
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            CustomerAccountId = account.Id,
            TokenHash = HashToken(token),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.Add(PasswordResetLifetime)
        });
        await db.SaveChangesAsync(cancellationToken);

        var resetUrl = $"{frontendBaseUrl}/account?mode=reset&token={Uri.EscapeDataString(token)}";
        try
        {
            await emailSender.SendPasswordResetAsync(email, resetUrl, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception) when (
            exception is InvalidOperationException or System.Net.Mail.SmtpException or
                System.Net.Sockets.SocketException)
        {
            logger.LogError(exception, "Could not send password reset email for account {AccountId}.",
                account.Id);
        }

        return Ok(PasswordResetRequestResponse());
    }

    [HttpPost("password-reset/confirm")]
    [EnableRateLimiting("account-auth")]
    public async Task<IActionResult> ConfirmPasswordReset(
        [FromBody] ConfirmPasswordResetRequest request,
        CancellationToken cancellationToken)
    {
        var tokenHash = HashToken(request.Token);
        var now = DateTime.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, cancellationToken);
        var reset = await db.PasswordResetTokens.FirstOrDefaultAsync(
            candidate => candidate.TokenHash == tokenHash &&
                candidate.UsedAtUtc == null &&
                candidate.ExpiresAtUtc > now,
            cancellationToken);
        if (reset is null)
            return BadRequest(new
            {
                message = "Lidhja e rikthimit është e pavlefshme ose ka skaduar. Kërko një lidhje të re."
            });

        var claimed = await db.PasswordResetTokens
            .Where(candidate => candidate.Id == reset.Id &&
                candidate.UsedAtUtc == null &&
                candidate.ExpiresAtUtc > now)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(candidate => candidate.UsedAtUtc, now),
                cancellationToken);
        if (claimed != 1)
            return BadRequest(new
            {
                message = "Lidhja e rikthimit është përdorur ose ka skaduar. Kërko një lidhje të re."
            });

        var account = await db.CustomerAccounts.FirstOrDefaultAsync(
            candidate => candidate.Id == reset.CustomerAccountId,
            cancellationToken);
        if (account is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new
            {
                message = "Lidhja e rikthimit është e pavlefshme. Kërko një lidhje të re."
            });
        }

        account.PasswordHash = passwordHasher.HashPassword(account, request.Password);
        await db.PasswordResetTokens
            .Where(candidate => candidate.CustomerAccountId == account.Id &&
                candidate.Id != reset.Id)
            .ExecuteDeleteAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var accountId))
            return Unauthorized();
        var account = await db.CustomerAccounts.AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == accountId, cancellationToken);
        if (account is null)
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized();
        }
        return Ok(ToResponse(account));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    private Task SignInAsync(CustomerAccount account)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.Email),
            new Claim(ClaimTypes.Role, "Customer")
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            claims, CookieAuthenticationDefaults.AuthenticationScheme));
        return HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                AllowRefresh = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });
    }

    private static object ToResponse(CustomerAccount account) => new
    {
        email = account.Email,
        firstName = account.FirstName,
        lastName = account.LastName
    };

    private static object PasswordResetRequestResponse() => new
    {
        message = "Nëse ekziston një llogari me këtë email, do të dërgojmë udhëzimet. Nëse email-i nuk arrin, provo përsëri më vonë."
    };

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

public sealed class RegisterAccountRequest
{
    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, StringLength(80, MinimumLength = 1)]
    public required string FirstName { get; init; }

    [Required, StringLength(80, MinimumLength = 1)]
    public required string LastName { get; init; }

    [Required, StringLength(128, MinimumLength = 8)]
    public required string Password { get; init; }
}

public sealed class LoginAccountRequest
{
    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, StringLength(128, MinimumLength = 1)]
    public required string Password { get; init; }
}

public sealed class RequestPasswordResetRequest
{
    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }
}

public sealed class ConfirmPasswordResetRequest
{
    [Required, StringLength(128, MinimumLength = 64)]
    public required string Token { get; init; }

    [Required, StringLength(128, MinimumLength = 8)]
    public required string Password { get; init; }
}
