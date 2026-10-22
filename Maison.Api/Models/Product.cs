namespace Maison.Api.Models;

public sealed class Product
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Category { get; set; }
    public required string Gender { get; set; }
    public decimal Price { get; set; }
    public decimal? SalePrice { get; set; }
    public required string Description { get; set; }
    public required string Image { get; set; }
    public required string SizesJson { get; set; }
    public required string ColorsJson { get; set; }
    public bool IsNew { get; set; }
    public bool IsBestSeller { get; set; }
    public int Stock { get; set; } = 100;
    public bool IsActive { get; set; } = true;
}
