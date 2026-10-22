namespace Maison.Api.Models;

public sealed class PaymentAttempt
{
    public Guid Id { get; set; }
    public required string Provider { get; set; }
    public required string ProviderOrderId { get; set; }
    public required string OrderJson { get; set; }
    public required string Status { get; set; }
    public decimal Total { get; set; }
    public long? CustomerOrderId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
