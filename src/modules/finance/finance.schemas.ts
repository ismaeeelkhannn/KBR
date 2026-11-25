import { z } from "zod";

const paisa = z.number().int().nonnegative().max(2_147_483_647);

export const purchaseSchema = z.object({
  idempotencyKey: z.string().min(16).max(100),
  branchId: z.string().min(1),
  supplierName: z.string().trim().max(120).optional(),
  invoiceNo: z.string().trim().max(60).optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantityBase: z.number().int().positive().max(10_000_000),
        lineTotalPaisa: paisa,
      })
    )
    .min(1)
    .max(100),
});
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const expenseSchema = z.object({
  idempotencyKey: z.string().min(16).max(100),
  branchId: z.string().min(1),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(3).max(200),
  amountPaisa: z.number().int().positive().max(2_147_483_647),
  expenseDate: z.string().datetime(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
