using System.Text.Json;
using Maison.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Maison.Api.Data;

public static class SeedData
{
    private static readonly string[] ClothingSizes = ["XS", "S", "M", "L", "XL"];
    private static readonly string[] ShoeSizes = ["38", "39", "40", "41", "42", "43", "44"];
    private static readonly string[] OneSize = ["Një madhësi"];

    public static async Task InitializeAsync(MaisonDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        await EnsureProductColumnsAsync(db);
        await EnsureOrderColumnsAsync(db);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductReviews" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductReviews" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "Name" TEXT NOT NULL,
                "Rating" INTEGER NOT NULL,
                "Comment" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_ProductReviews_ProductId_CreatedAtUtc"
                ON "ProductReviews" ("ProductId", "CreatedAtUtc");
            CREATE TABLE IF NOT EXISTS "ContactMessages" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ContactMessages" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "Email" TEXT NOT NULL,
                "Message" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "IX_ContactMessages_CreatedAtUtc"
                ON "ContactMessages" ("CreatedAtUtc");
            CREATE TABLE IF NOT EXISTS "CustomerAccounts" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_CustomerAccounts" PRIMARY KEY AUTOINCREMENT,
                "Email" TEXT NOT NULL,
                "FirstName" TEXT NOT NULL,
                "LastName" TEXT NOT NULL,
                "PasswordHash" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CustomerAccounts_Email"
                ON "CustomerAccounts" ("Email");
            CREATE TABLE IF NOT EXISTS "PasswordResetTokens" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_PasswordResetTokens" PRIMARY KEY AUTOINCREMENT,
                "CustomerAccountId" INTEGER NOT NULL,
                "TokenHash" TEXT NOT NULL,
                "CreatedAtUtc" TEXT NOT NULL,
                "ExpiresAtUtc" TEXT NOT NULL,
                "UsedAtUtc" TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PasswordResetTokens_TokenHash"
                ON "PasswordResetTokens" ("TokenHash");
            CREATE INDEX IF NOT EXISTS "IX_PasswordResetTokens_CustomerAccountId_ExpiresAtUtc"
                ON "PasswordResetTokens" ("CustomerAccountId", "ExpiresAtUtc");
            CREATE TABLE IF NOT EXISTS "PaymentAttempts" (
                "Id" TEXT NOT NULL CONSTRAINT "PK_PaymentAttempts" PRIMARY KEY,
                "Provider" TEXT NOT NULL,
                "ProviderOrderId" TEXT NOT NULL,
                "OrderJson" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "Total" TEXT NOT NULL,
                "CustomerOrderId" INTEGER NULL,
                "CreatedAtUtc" TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PaymentAttempts_ProviderOrderId"
                ON "PaymentAttempts" ("ProviderOrderId");
            """);
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE "Products"
            SET "Gender" = CASE
                WHEN "Category" IN ('Femra', 'Çanta') THEN 'Femra'
                WHEN "Category" = 'Meshkuj' THEN 'Meshkuj'
                WHEN "Id" IN (8, 11, 12) THEN 'Femra'
                WHEN "Id" IN (9, 10) THEN 'Meshkuj'
                ELSE 'Unisex'
            END
            WHERE "Gender" = '';
            UPDATE "Products" SET "IsBestSeller" = 1 WHERE "Id" IN (19, 23);
            """);
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE "Orders" SET "Status" = 'SentToCourier' WHERE "Status" = 'Shipped';
            """);
        if (await db.Products.AnyAsync())
            return;

        db.Products.AddRange(
            Product(1, "Fustan veror", "Femra", 59.99m, 39.99m, ["Zi", "Bardhë", "Kuq"], ClothingSizes, "fustani-bardh.jpg", "Fustan i lehtë nga pambuku, prerje elegante deri te gjuri.", true, isBestSeller: true),
            Product(16, "Fustan veror", "Femra", 59.99m, 32.99m, ["Zi", "Bardhë", "Kuq"], ClothingSizes, "fustani-zi.jpg", "Fustan i lehtë nga pambuku, prerje elegante deri te gjuri.", true),
            Product(2, "Jakne per femra", "Femra", 34.99m, null, ["Kafe"], ClothingSizes, "jakne-femra.avif", "Jakne nga liri natyral, e përshtatshme për çdo ditë.", true),
            Product(3, "Bleizer klasik", "Femra", 89m, null, ["Zi", "Gri"], ClothingSizes, "dukseri2.jpg", "Bleizer me prerje të drejtë dhe astar të butë."),
            Product(4, "Texas per djem", "Meshkuj", 54.99m, 44.99m, ["Blu"], ClothingSizes, "denim1.jpg", "Texas i kaltert dhe elegant."),
            Product(5, "Bluze bazë", "Meshkuj", 19.99m, null, ["Zi", "Bardhë", "Gri"], ClothingSizes, "bluza1.jpg", "Bluze nga pambuku 100%, peshë mesatare.", true, isBestSeller: true),
            Product(6, "Zipper", "Meshkuj", 42m, null, ["Zi"], ClothingSizes, "dukseri1.jpg", "Zipper klasike kualitative."),
            Product(7, "Hoodie per djem", "Meshkuj", 129m, null, ["Gri", "Kafe"], ClothingSizes, "dukseri2.jpg", "Hoodie nga pambuku premium."),
            Product(8, "Sneakers minimal", "Këpucë", 89.99m, null, ["Bardhë", "Zi"], ShoeSizes, "patikat1.jpg", "Atlete minimale me shputë të rehatshme.", true, "Femra", true),
            Product(9, "Çizme Chelsea", "Këpucë", 109m, 89m, ["Zi", "Kafe"], ShoeSizes, "patikat2.jpg", "Çizme nga lëkura me elastik anash.", gender: "Meshkuj", isBestSeller: true),
            Product(10, "Kundra", "Këpucë", 109m, 89m, ["Zi", "Kafe"], ShoeSizes, "kepuce-zi.jpg", "Kundra nga lëkura per evente.", gender: "Meshkuj"),
            Product(11, "Sneakers te bardha", "Këpucë", 75m, null, ["Zi", "Kafe"], ShoeSizes, "patika-bardh.jpg", "Sneakers te perditshme te bardha.", gender: "Femra"),
            Product(12, "Sneakers te gjelbra", "Këpucë", 79m, null, ["Zi", "Kafe"], ShoeSizes, "patika-jeshil.jpg", "Sneakers te perditshme te gjelbra.", gender: "Femra"),
            Product(13, "Çantë dore", "Çanta", 74.99m, null, ["Zi", "Gjelbertë", "Kuqe"], OneSize, "canta-zi.jpg", "Çantë e strukturuar me rrip të zgjatshëm.", isBestSeller: true),
            Product(14, "Çantë dore", "Çanta", 49m, null, ["Zi", "Gjelbertë", "Kuqe"], OneSize, "canta-jeshil.jpg", "Çantë e përditshme me rrip të zgjatshëm."),
            Product(15, "Çantë dore", "Çanta", 50.99m, null, ["Zi", "Gjelbertë", "Kuqe"], OneSize, "canta-kuq.jpg", "Çantë e përditshme me rrip të zgjatshëm."),
            Product(17, "Pantollona për djem", "Meshkuj", 63.99m, 49.99m, ["Gri", "Kaltert"], ClothingSizes, "pantolla-per-djem-gray.jpg", "Pantollona e shtrënguar me prerje të qetë dhe të përshtatshme për ditë dhe mbrëmje.", true, isBestSeller: true),
            Product(18, "Pantollona për djem", "Meshkuj", 63.99m, 49.99m, ["Gri", "Kaltert"], ClothingSizes, "pantolla-per-djem-kalter.jpg", "Pantollona e shtrënguar me prerje të qetë dhe të përshtatshme për ditë dhe mbrëmje.", true),
            Product(19, "Pantollona për femra", "Femra", 63.99m, 33.99m, ["Bardh", "Zi"], ClothingSizes, "pantollat-femra-bardh.jpg", "Pantollona e shtrënguar me prerje të qetë dhe të përshtatshme për ditë dhe mbrëmje.", true, isBestSeller: true),
            Product(20, "Pantollona për femra", "Femra", 63.99m, 36.99m, ["Bardh", "Zi"], ClothingSizes, "pantollat-femra-zi.jpg", "Pantollona e shtrënguar me prerje të qetë dhe të përshtatshme për ditë dhe mbrëmje.", true),
            Product(21, "Xhakete për femra", "Femra", 63.99m, 50.99m, ["Bardh", "Zi"], ClothingSizes, "jakna-bardh-femra.jpg", "Xhakete e shtrënguar me prerje të qetë dhe të përshtatshme për vjeshte.", true),
            Product(22, "Xhakete për femra", "Femra", 63.99m, 50.99m, ["Bardh", "Zi"], ClothingSizes, "jakna-gri.jpg", "Xhakete e shtrënguar me prerje të qetë dhe të përshtatshme për vjeshte.", true),
            Product(23, "Kaput i zi per djem", "Meshkuj", 80.99m, 64.99m, ["Zi", "Kafe", "Gri"], ClothingSizes, "kaput-zi.webp", "Kaput i zi per per burra per dimer, elegant dhe komfortabel.", isBestSeller: true),
            Product(24, "Kaput gri per djem", "Meshkuj", 80.99m, 64.99m, ["Zi", "Kafe", "Gri"], ClothingSizes, "kaput-gri.jpg", "Kaput i gri per per burra per dimer, elegant dhe komfortabel."),
            Product(25, "Kaput kafe per djem", "Meshkuj", 80.99m, 64.99m, ["Zi", "Kafe", "Gri"], ClothingSizes, "kaput-kafe.jpg", "Kaput kafe per per burra per dimer, elegant dhe komfortabel."),
            Product(26, "Xhakete lekure per femra", "Femra", 30.99m, null, ["Zi"], ClothingSizes, "xhaket-lekure.jpg", "Xhakete lekure per femra per veshje casual"),
            Product(27, "Pantollona skinny për femra", "Femra", 63.99m, null, ["Gri", "Zi"], ClothingSizes, "pantolla-femra-gri.jpg", "Pantollona e shtrënguar me prerje të qetë dhe të përshtatshme për ditë dhe mbrëmje.", true),
            Product(28, "Hoodie per djem", "Meshkuj", 129m, null, ["Zi", "Bardh"], ClothingSizes, "hoodie-zi.jpg", "Hoodie nga pambuku premium.")
        );
        await db.SaveChangesAsync();
    }

    private static async Task EnsureProductColumnsAsync(MaisonDbContext db)
    {
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try
        {
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info('Products')";
            await using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                    columns.Add(reader.GetString(1));
            }

            if (!columns.Contains("Gender"))
                await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Products\" ADD COLUMN \"Gender\" TEXT NOT NULL DEFAULT ''");
            var addedBestSellerColumn = !columns.Contains("IsBestSeller");
            if (addedBestSellerColumn)
            {
                await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Products\" ADD COLUMN \"IsBestSeller\" INTEGER NOT NULL DEFAULT 0");
                await db.Database.ExecuteSqlRawAsync("UPDATE \"Products\" SET \"IsBestSeller\" = 1 WHERE \"Id\" IN (1, 5, 8, 9, 13, 17)");
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static async Task EnsureOrderColumnsAsync(MaisonDbContext db)
    {
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try
        {
            var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA table_info('Orders')";
            await using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                    columns.Add(reader.GetString(1));
            }

            if (!columns.Contains("IsArchived"))
                await db.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Orders\" ADD COLUMN \"IsArchived\" INTEGER NOT NULL DEFAULT 0");
            await db.Database.ExecuteSqlRawAsync(
                "CREATE INDEX IF NOT EXISTS \"IX_Orders_Email\" ON \"Orders\" (\"Email\")");
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private static Product Product(
        int id,
        string name,
        string category,
        decimal price,
        decimal? salePrice,
        string[] colors,
        string[] sizes,
        string image,
        string description,
        bool isNew = false,
        string? gender = null,
        bool isBestSeller = false) =>
        new()
        {
            Id = id,
            Name = name,
            Category = category,
            Gender = gender ?? category switch
            {
                "Femra" or "Çanta" => "Femra",
                "Meshkuj" => "Meshkuj",
                _ => "Unisex"
            },
            Price = price,
            SalePrice = salePrice,
            ColorsJson = JsonSerializer.Serialize(colors),
            SizesJson = JsonSerializer.Serialize(sizes),
            Image = $"/foto/fotot/{image}",
            Description = description,
            IsNew = isNew,
            IsBestSeller = isBestSeller,
            Stock = 100
        };
}
