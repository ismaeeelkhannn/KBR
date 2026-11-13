import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";

export class RecipeError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RecipeError";
    this.status = status;
  }
}

/** Variant ka latest recipe version (sirf naya version banane ke liye, purana edit nahi hota). */
export async function latestRecipeVersion(variantId: string) {
  return db.recipeVersion.findFirst({
    where: { variantId },
    orderBy: { version: "desc" },
    include: { lines: true },
  });
}

/**
 * Naya recipe version banata hai. Purana version touch nahi hota.
 * lines: [{ inventoryItemId, quantityBase }]
 */
export async function createRecipeVersion(
  userId: string,
  variantId: string,
  lines: { inventoryItemId: string; quantityBase: number }[]
) {
  if (!(await userHasPermission(userId, "recipes.manage"))) {
    throw new RecipeError("Recipe badalne ki ijazat nahi", 403);
  }
  if (lines.length === 0) {
    throw new RecipeError("Recipe mein kam se kam ek ingredient chahiye", 422);
  }
  if (
    lines.some(
      (line) =>
        !Number.isInteger(line.quantityBase) || line.quantityBase <= 0
    )
  ) {
    throw new RecipeError("Quantity positive integer honi chahiye", 422);
  }

  const inventoryItemIds = lines.map((line) => line.inventoryItemId);
  const uniqueInventoryItemIds = [...new Set(inventoryItemIds)];
  if (uniqueInventoryItemIds.length !== inventoryItemIds.length) {
    throw new RecipeError("Ingredient recipe mein sirf ek baar aa sakta hai", 422);
  }

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
  });
  if (!variant) throw new RecipeError("Variant nahi mila", 404);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [lockedVariant] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "ProductVariant"
      WHERE "id" = ${variantId}
      FOR UPDATE
    `;
    if (!lockedVariant) throw new RecipeError("Variant nahi mila", 404);

    const existingItems = await tx.inventoryItem.findMany({
      where: { id: { in: uniqueInventoryItemIds } },
      select: { id: true },
    });
    if (existingItems.length !== uniqueInventoryItemIds.length) {
      throw new RecipeError("Ingredient nahi mila", 404);
    }

    const last = await tx.recipeVersion.findFirst({
      where: { variantId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const recipe = await tx.recipeVersion.create({
      data: {
        variantId,
        version: nextVersion,
        createdById: userId,
        lines: { create: lines },
      },
      include: { lines: true },
    });

    await writeAudit(tx, {
      actorId: userId,
      action: "RECIPE_VERSION_CREATED",
      entityType: "ProductVariant",
      entityId: variantId,
      after: { version: nextVersion, lines },
    });

    return recipe;
  });
}
