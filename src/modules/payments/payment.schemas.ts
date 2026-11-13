import { z } from "zod";

export const paySchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  cashShiftId: z.string().min(1),
  method: z.enum(["CASH", "JAZZCASH", "EASYPAISA", "BANK_TRANSFER", "CARD"]),
  amountPaisa: z.number().int().positive(),
  reference: z.string().trim().max(100).optional(),
});

export const closeShiftSchema = z.object({
  countedCashPaisa: z.number().int().min(0),
  varianceReason: z.string().trim().min(3).max(300).optional(),
});

export type PayInput = z.infer<typeof paySchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
