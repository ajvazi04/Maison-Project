using System.ComponentModel.DataAnnotations;
using Maison.Api.Data;
using Maison.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class FeedbackController(MaisonDbContext db) : ControllerBase
{
    [HttpGet("products/{productId:int}/reviews")]
    public async Task<ActionResult<ProductReviewsResponse>> GetProductReviews(
        int productId,
        CancellationToken cancellationToken)
    {
        if (!await db.Products.AnyAsync(
                product => product.Id == productId && product.IsActive,
                cancellationToken))
            return NotFound(new { message = "Produkti nuk u gjet." });

        var reviews = await db.ProductReviews.AsNoTracking()
            .Where(review => review.ProductId == productId)
            .OrderByDescending(review => review.Id)
            .Select(review => new ProductReviewResponse(
                review.Id, review.Name, review.Rating, review.Comment, review.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var average = reviews.Count == 0
            ? 0m
            : decimal.Round((decimal)reviews.Average(review => review.Rating), 1);
        return Ok(new ProductReviewsResponse(average, reviews.Count, reviews));
    }

    [HttpPost("products/{productId:int}/reviews")]
    [EnableRateLimiting("feedback")]
    public async Task<ActionResult<ProductReviewResponse>> CreateProductReview(
        int productId,
        [FromBody] CreateProductReviewRequest request,
        CancellationToken cancellationToken)
    {
        if (!await db.Products.AnyAsync(
                product => product.Id == productId && product.IsActive,
                cancellationToken))
            return NotFound(new { message = "Produkti nuk u gjet." });

        var review = new ProductReview
        {
            ProductId = productId,
            Name = request.Name.Trim(),
            Rating = request.Rating,
            Comment = request.Comment.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        db.ProductReviews.Add(review);
        await db.SaveChangesAsync(cancellationToken);

        var response = new ProductReviewResponse(
            review.Id, review.Name, review.Rating, review.Comment, review.CreatedAtUtc);
        return CreatedAtAction(nameof(GetProductReviews), new { productId }, response);
    }

    [HttpPost("contact")]
    [EnableRateLimiting("feedback")]
    public async Task<IActionResult> CreateContactMessage(
        [FromBody] CreateContactMessageRequest request,
        CancellationToken cancellationToken)
    {
        db.ContactMessages.Add(new ContactMessage
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Message = request.Message.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        return Created("/api/admin/contact-messages", new { message = "Mesazhi u regjistrua." });
    }
}

/// <summary>Request to add a public review to a product.</summary>
public sealed record CreateProductReviewRequest : IValidatableObject
{
    [Required, StringLength(80, MinimumLength = 1)]
    public required string Name { get; init; }

    [Range(1, 5)]
    public int Rating { get; init; }

    [Required, StringLength(1000, MinimumLength = 3)]
    public required string Comment { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Name))
            yield return new ValidationResult("Emri nuk mund të jetë bosh.", [nameof(Name)]);
        else if (Name.Trim().Length > 80)
            yield return new ValidationResult("Emri nuk mund të jetë më i gjatë se 80 karaktere.", [nameof(Name)]);

        if (string.IsNullOrWhiteSpace(Comment))
            yield return new ValidationResult("Komenti nuk mund të jetë bosh.", [nameof(Comment)]);
        else if (Comment.Trim().Length < 3 || Comment.Trim().Length > 1000)
            yield return new ValidationResult("Komenti duhet të ketë nga 3 deri në 1000 karaktere.", [nameof(Comment)]);
    }
}

/// <summary>Request to send a message to Maison.</summary>
public sealed record CreateContactMessageRequest : IValidatableObject
{
    [Required, StringLength(80, MinimumLength = 1)]
    public required string Name { get; init; }

    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, StringLength(2000, MinimumLength = 3)]
    public required string Message { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Name))
            yield return new ValidationResult("Emri nuk mund të jetë bosh.", [nameof(Name)]);
        else if (Name.Trim().Length > 80)
            yield return new ValidationResult("Emri nuk mund të jetë më i gjatë se 80 karaktere.", [nameof(Name)]);

        if (string.IsNullOrWhiteSpace(Message))
            yield return new ValidationResult("Mesazhi nuk mund të jetë bosh.", [nameof(Message)]);
        else if (Message.Trim().Length < 3 || Message.Trim().Length > 2000)
            yield return new ValidationResult("Mesazhi duhet të ketë nga 3 deri në 2000 karaktere.", [nameof(Message)]);
    }
}

/// <summary>A customer review for a product.</summary>
public sealed record ProductReviewResponse(
    long Id,
    string Name,
    int Rating,
    string Comment,
    DateTimeOffset CreatedAtUtc);

/// <summary>The average rating and reviews for a product.</summary>
public sealed record ProductReviewsResponse(
    decimal AverageRating,
    int ReviewCount,
    IReadOnlyList<ProductReviewResponse> Reviews);