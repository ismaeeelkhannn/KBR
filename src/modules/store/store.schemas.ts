import { z } from "zod";

export const requisitionSchema = z.object({
  branchId: z.string().min(1),
  purpose: z.string().trim().min(3).max(200),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        requestedQty: z.number().int().positive().max(100000),
        note: z.string().trim().max(200).optional(),
      })
    )
    .min(1)
    .max(50),
});
export type RequisitionInput = z.infer<typeof requisitionSchema>;
