namespace Maison.Api.Models;

public sealed class ContactMessage
{
    public long Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public required string Message { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}