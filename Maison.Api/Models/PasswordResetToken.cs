namespace Maison.Api.Models;

public sealed class PasswordResetToken
{
    public long Id { get; set; }
    public long CustomerAccountId { get; set; }
    public required string TokenHash { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }
}
