import type { Prisma } from "@prisma/client";

/**
 * Cancel hone wale order ke ingredients ka wastage record.
 * Stock wapas nahi aata. Har deduction ka ulta sign nahi, balke WASTAGE ki nayi row.
 * Ye sirf SALE_DEDUCTION rows ke hisaab se banta hai, taake double count na ho.
 */
export async function createWastageForOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  reason: string
): Promise<void> {
  const deductions = await tx.stockMovement.findMany({
    where: { orderId, type: "SALE_DEDUCTION" },
    select: { branchId: true, inventoryItemId: true, quantityBase: true },
  });

  for (const deduction of deductions) {
    await tx.stockMovement.create({
      data: {
        branchId: deduction.branchId,
        inventoryItemId: deduction.inventoryItemId,
        type: "WASTAGE",
        quantityBase: deduction.quantityBase,
        orderId,
        reason: `Cancel wastage: ${reason}`,
        createdById: userId,
      },
    });
  }
}
