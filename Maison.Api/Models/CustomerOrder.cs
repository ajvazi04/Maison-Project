namespace Maison.Api.Models;

public sealed class CustomerOrder
{
    public long Id { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Email { get; set; }
    public required string Phone { get; set; }
    public required string Country { get; set; }
    public required string City { get; set; }
    public required string Address { get; set; }
    public string? PostalCode { get; set; }
    public required string PaymentMethod { get; set; }
    public required string Status { get; set; }
    public bool IsArchived { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Shipping { get; set; }
    public decimal Total { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public List<OrderItem> Items { get; set; } = [];
}

public sealed class OrderItem
{
    public long Id { get; set; }
    public long CustomerOrderId { get; set; }
    public required string ProductName { get; set; }
    public int ProductId { get; set; }
    public required string Size { get; set; }
    public required string Color { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}
