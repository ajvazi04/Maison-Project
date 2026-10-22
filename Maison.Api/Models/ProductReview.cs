namespace Maison.Api.Models;

public sealed class ProductReview
{
    public long Id { get; set; }
    public int ProductId { get; set; }
    public required string Name { get; set; }
    public int Rating { get; set; }
    public required string Comment { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}