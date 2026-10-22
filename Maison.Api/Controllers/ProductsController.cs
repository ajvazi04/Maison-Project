using System.Text.Json;
using Maison.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(MaisonDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? category,
        [FromQuery] string? q,
        CancellationToken cancellationToken)
    {
        var query = db.Products.AsNoTracking().Where(product => product.IsActive);
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(product => product.Category == category);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var search = q.Trim().ToLower();
            query = query.Where(product =>
                product.Name.ToLower().Contains(search) ||
                product.Category.ToLower().Contains(search) ||
                product.Description.ToLower().Contains(search));
        }

        var products = await query.OrderBy(product => product.Id).ToListAsync(cancellationToken);
        return Ok(products.Select(product => new
        {
            id = product.Id,
            name = product.Name,
            cat = product.Category,
            gender = product.Gender,
            price = product.Price,
            sale = product.SalePrice,
            desc = product.Description,
            img = product.Image,
            colors = JsonSerializer.Deserialize<string[]>(product.ColorsJson) ?? [],
            sizes = JsonSerializer.Deserialize<string[]>(product.SizesJson) ?? [],
            isNew = product.IsNew,
            isBestSeller = product.IsBestSeller,
            stock = product.Stock
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProduct(int id, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(product => product.Id == id && product.IsActive, cancellationToken);
        if (product is null)
            return NotFound(new { message = "Produkti nuk u gjet." });

        return Ok(new
        {
            id = product.Id,
            name = product.Name,
            cat = product.Category,
            gender = product.Gender,
            price = product.Price,
            sale = product.SalePrice,
            desc = product.Description,
            img = product.Image,
            colors = JsonSerializer.Deserialize<string[]>(product.ColorsJson) ?? [],
            sizes = JsonSerializer.Deserialize<string[]>(product.SizesJson) ?? [],
            isNew = product.IsNew,
            isBestSeller = product.IsBestSeller,
            stock = product.Stock
        });
    }
}
