import { z } from "zod";

export const cancelRequestSchema = z.object({
  reason: z.string().trim().min(3).max(200),
});

export const decideApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(200).optional(),
});
