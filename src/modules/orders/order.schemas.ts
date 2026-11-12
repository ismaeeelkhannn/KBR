import { z } from "zod";

export const createOrderSchema = z.object({
  idempotencyKey: z.string().min(16).max(100),
  branchId: z.string().min(1),
  orderType: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).default("TAKEAWAY"),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        note: z.string().max(200).optional(),
      })
    )
    .min(1)
    .max(50),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
