import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { lockInventoryItems } from "./stock-lock";

export class InventoryError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InventoryError";
    this.status = status;
  }
}

/** Branch ka current stock (ledger ka sum). Direct balance column nahi hai. */
export async function getStockBalances(userId: string, branchId: string) {
  if (!(await userHasPermission(userId, "inventory.view"))) {
    throw new InventoryError("Stock dekhne ki ijazat nahi", 403);
  }
  if (!(await userCanAccessBranch(userId, branchId))) {
    throw new InventoryError("Is branch ka access aap ke paas nahi", 403);
  }

  const items = await db.inventoryItem.findMany({ orderBy: { code: "asc" } });
  const sums = await db.stockMovement.groupBy({
    by: ["inventoryItemId"],
    where: {
      branchId,
    },
    _sum: { quantityBase: true },
  });
  const map = new Map(
    sums.map((sum) => [sum.inventoryItemId, sum._sum.quantityBase ?? 0])
  );

  return items.map((item) => ({
    id: item.id,    code: item.code,
    name: item.name,
    unit: item.unit,
    balance: map.get(item.id) ?? 0,
  }));
}

/**
 * Order ke items ki recipe ke hisaab se stock kam karta hai.
 * Ye tx ke andar chalta hai: agar koi bhi item kam pad jaye to pura status change rollback.
 */
export async function deductForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  branchId: string,
  userId: string
): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: {
      quantity: true,
      variant: { select: { name: true } },
      recipeVersion: { select: { lines: true } },
    },
  });

  const need = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new InventoryError("Order quantity ghalat hai", 422);
    }

    const lines = item.recipeVersion?.lines ?? [];
    if (lines.length === 0) {
      throw new InventoryError(
        `Recipe version missing: ${item.variant.name}`,
        422
      );
    }
    for (const line of lines) {
      if (!Number.isInteger(line.quantityBase) || line.quantityBase <= 0) {
        throw new InventoryError(`Recipe quantity ghalat: ${item.variant.name}`, 422);
      }

      const previous = need.get(line.inventoryItemId) ?? 0;
      need.set(
        line.inventoryItemId,
        previous + line.quantityBase * item.quantity
      );
    }
  }

  const requirements = [...need.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );

  await lockInventoryItems(
    tx,
    requirements.map(([inventoryItemId]) => inventoryItemId)
  );

  for (const [inventoryItemId, quantity] of requirements) {
    const inventoryItem = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: inventoryItemId },
    });
    const aggregate = await tx.stockMovement.aggregate({
      where: { branchId, inventoryItemId },
      _sum: { quantityBase: true },
    });
    const available = aggregate._sum.quantityBase ?? 0;

    if (available < quantity) {
      throw new InventoryError(
        `Stock kam hai: ${inventoryItem.name} (chahiye ${quantity} ${inventoryItem.unit}, available ${available} ${inventoryItem.unit})`,
        422
      );
    }

    await tx.stockMovement.create({
      data: {
        branchId,
        inventoryItemId,
        type: "SALE_DEDUCTION",
        quantityBase: -quantity,
        orderId,
        reason: "Order PREPARING",
        createdById: userId,
      },
    });
  }
}

