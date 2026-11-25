import type { StockMovementType } from "@prisma/client";

/**
 * On-hand stock = sum of quantityBase over movement types that really move stock.
 *
 * WASTAGE rows are a loss RECORD, not a second stock movement. A cancelled
 * order's SALE_DEDUCTION already reduced stock, and the WASTAGE row copies the
 * same quantity only so reports can show what was lost. Summing WASTAGE into
 * on-hand would subtract that consumption twice.
 */
export const NON_ONHAND_MOVEMENT_TYPES: StockMovementType[] = ["WASTAGE"];

export function isOnHandMovement(type: string): boolean {
  return !(NON_ONHAND_MOVEMENT_TYPES as string[]).includes(type);
}

/** Prisma filter fragment to add to any on-hand stock aggregate. */
export const onHandWhere = {
  type: { notIn: [...NON_ONHAND_MOVEMENT_TYPES] },
};

export function sumOnHand(
  movements: ReadonlyArray<{ type: string; quantityBase: number }>,
): number {
  return movements.reduce(
    (total, m) => (isOnHandMovement(m.type) ? total + m.quantityBase : total),
    0,
  );
}