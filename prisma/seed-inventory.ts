import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * DEMO inventory aur recipes.
 * - Quantities placeholder hain. Owner real recipe confirm karega.
 * - Idempotent: purchase sirf pehli baar banti hai.
 */

const prisma = new PrismaClient();

const ITEMS = [
  { code: "DEMO-CHICKEN", name: "DEMO Chicken", unit: "g" },
  { code: "DEMO-BUN", name: "DEMO Burger Bun", unit: "pcs" },
  { code: "DEMO-MAYO", name: "DEMO Mayonnaise", unit: "g" },
  { code: "DEMO-PACKAGING", name: "DEMO Packaging", unit: "pcs" },
  { code: "DEMO-DRINK-BOTTLE", name: "DEMO Drink Bottle", unit: "pcs" },
];

// Per 1 item (variant code => ingredient code => quantity base unit mein)
const RECIPES: Record<string, Record<string, number>> = {
  "DEMO-CHICKEN-BURGER-REG": {
    "DEMO-CHICKEN": 120,
    "DEMO-BUN": 1,
    "DEMO-MAYO": 20,
    "DEMO-PACKAGING": 1,
  },
  "DEMO-SOFT-DRINK-500ML": {
    "DEMO-DRINK-BOTTLE": 1,
    "DEMO-PACKAGING": 1,
  },
};

const OPENING_STOCK: Record<string, number> = {
  "DEMO-CHICKEN": 10000,
  "DEMO-BUN": 100,
  "DEMO-MAYO": 5000,
  "DEMO-PACKAGING": 200,
  "DEMO-DRINK-BOTTLE": 50,
};

async function main() {
  const ownerUsername = process.env.DEMO_OWNER_USERNAME ?? "owner";
  const owner = await prisma.user.findUnique({
    where: { username: ownerUsername },
  });
  const branch = await prisma.branch.findUnique({
    where: { code: "DEMO-MAIN" },
  });
  if (!owner || !branch) {
    throw new Error(
      "Pehle DEMO owner aur DEMO-MAIN branch tayyar karein (db:seed, db:create-owner)."
    );
  }

  for (const item of ITEMS) {
    await prisma.inventoryItem.upsert({
      where: { code: item.code },
      update: { name: item.name, unit: item.unit },
      create: item,
    });
  }

  const items = await prisma.inventoryItem.findMany({
    where: { code: { in: ITEMS.map((item) => item.code) } },
  });
  const idByCode = new Map(items.map((item) => [item.code, item.id]));

  function getInventoryItemId(code: string): string {
    const id = idByCode.get(code);
    if (!id) {
      throw new Error(`Inventory item seed nahi hua: ${code}`);
    }
    return id;
  }

  for (const [variantCode, lines] of Object.entries(RECIPES)) {
    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { code: variantCode },
    });
    for (const [ingredientCode, quantityBase] of Object.entries(lines)) {
      const inventoryItemId = getInventoryItemId(ingredientCode);
      await prisma.recipeLine.upsert({
        where: {
          variantId_inventoryItemId: {
            variantId: variant.id,
            inventoryItemId,
          },
        },
        update: { quantityBase },
        create: { variantId: variant.id, inventoryItemId, quantityBase },
      });
    }
  }

  for (const [code, quantity] of Object.entries(OPENING_STOCK)) {
    const inventoryItemId = getInventoryItemId(code);
    const exists = await prisma.stockMovement.findFirst({
      where: {
        branchId: branch.id,
        inventoryItemId,
        type: "PURCHASE",
        reason: "DEMO opening stock",
      },
    });
    if (!exists) {
      await prisma.stockMovement.create({
        data: {
          branchId: branch.id,
          inventoryItemId,
          type: "PURCHASE",
          quantityBase: quantity,
          reason: "DEMO opening stock",
          createdById: owner.id,
        },
      });
    }
  }

  console.log(
    `${ITEMS.length} items, ${Object.keys(RECIPES).length} recipes, opening stock tayyar`
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Inventory seed FAILED:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
