using Maison.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Data;

public sealed class MaisonDbContext(DbContextOptions<MaisonDbContext> options)
    : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<CustomerOrder> Orders => Set<CustomerOrder>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<CustomerAccount> CustomerAccounts => Set<CustomerAccount>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<PaymentAttempt> PaymentAttempts => Set<PaymentAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>().Property(product => product.Price).HasPrecision(10, 2);
        modelBuilder.Entity<Product>().Property(product => product.SalePrice).HasPrecision(10, 2);
        modelBuilder.Entity<Product>().HasIndex(product => product.Category);
        modelBuilder.Entity<Product>().HasIndex(product => product.Gender);

        modelBuilder.Entity<CustomerOrder>().HasIndex(order => order.CreatedAtUtc);
        modelBuilder.Entity<CustomerOrder>().HasIndex(order => order.Email);
        modelBuilder.Entity<CustomerOrder>().Property(order => order.Subtotal).HasPrecision(10, 2);
        modelBuilder.Entity<CustomerOrder>().Property(order => order.Discount).HasPrecision(10, 2);
        modelBuilder.Entity<CustomerOrder>().Property(order => order.Shipping).HasPrecision(10, 2);
        modelBuilder.Entity<CustomerOrder>().Property(order => order.Total).HasPrecision(10, 2);
        modelBuilder.Entity<CustomerOrder>()
            .HasMany(order => order.Items)
            .WithOne()
            .HasForeignKey(item => item.CustomerOrderId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<OrderItem>().Property(item => item.UnitPrice).HasPrecision(10, 2);
        modelBuilder.Entity<OrderItem>().Property(item => item.LineTotal).HasPrecision(10, 2);

        modelBuilder.Entity<ProductReview>().HasIndex(review => new { review.ProductId, review.CreatedAtUtc });
        modelBuilder.Entity<ContactMessage>().HasIndex(message => message.CreatedAtUtc);
        modelBuilder.Entity<CustomerAccount>().HasIndex(account => account.Email).IsUnique();
        modelBuilder.Entity<PasswordResetToken>().HasIndex(token => token.TokenHash).IsUnique();
        modelBuilder.Entity<PasswordResetToken>().HasIndex(token => new
        {
            token.CustomerAccountId,
            token.ExpiresAtUtc
        });
        modelBuilder.Entity<PaymentAttempt>().HasIndex(attempt => attempt.ProviderOrderId).IsUnique();
        modelBuilder.Entity<PaymentAttempt>().Property(attempt => attempt.Total).HasPrecision(10, 2);
    }
}
