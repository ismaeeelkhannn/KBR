import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * DEMO catalog.
 * - Naam aur prices sirf placeholder hain. Asli menu aur prices owner verify karega.
 * - isVerified = false ka matlab: ye price abhi verify nahi hua.
 * - Idempotent: dobara chalane par duplicate nahi banta.
 */

const prisma = new PrismaClient();

// Paisa mein. 50000 = Rs. 500 (DEMO value)
const DEMO_CATALOG = [
  {
    code: "DEMO-BURGERS",
    name: "DEMO Burgers",
    sortOrder: 1,
    products: [
      {
        code: "DEMO-CHICKEN-BURGER",
        name: "DEMO Chicken Burger",
        variants: [
          {
            code: "DEMO-CHICKEN-BURGER-REG",
            name: "Regular",
            amountPaisa: 50000,
          },
        ],
      },
    ],
  },
  {
    code: "DEMO-BEVERAGES",
    name: "DEMO Beverages",
    sortOrder: 2,
    products: [
      {
        code: "DEMO-SOFT-DRINK",
        name: "DEMO Soft Drink",
        variants: [
          {
            code: "DEMO-SOFT-DRINK-500ML",
            name: "500 ml",
            amountPaisa: 10000,
          },
        ],
      },
    ],
  },
];

async function main() {
  let productCount = 0;
  let variantCount = 0;

  for (const cat of DEMO_CATALOG) {
    const category = await prisma.category.upsert({
      where: { code: cat.code },
      update: { name: cat.name, sortOrder: cat.sortOrder },
      create: { code: cat.code, name: cat.name, sortOrder: cat.sortOrder },
    });

    for (const prod of cat.products) {
      const product = await prisma.product.upsert({
        where: { code: prod.code },
        update: { name: prod.name },
        create: { code: prod.code, name: prod.name, categoryId: category.id },
      });
      productCount++;

      for (const v of prod.variants) {
        const variant = await prisma.productVariant.upsert({
          where: { code: v.code },
          update: { name: v.name },
          create: { code: v.code, name: v.name, productId: product.id },
        });
        variantCount++;

        const existingPrice = await prisma.priceVersion.findFirst({
          where: { variantId: variant.id },
        });
        if (!existingPrice) {
          await prisma.priceVersion.create({
            data: {
              variantId: variant.id,
              amountPaisa: v.amountPaisa,
              isVerified: false,
              note: "DEMO price - owner verify karega",
            },
          });
        }
      }
    }
  }

  console.log(
    `✅ ${DEMO_CATALOG.length} categories, ${productCount} products, ${variantCount} variants tayyar`
  );
}

main()
  .catch((error) => {
    console.error("❌ Catalog seed FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
