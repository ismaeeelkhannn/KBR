import { z } from "zod";

export const changeStatusSchema = z.object({
  to: z.enum(["PREPARING", "READY", "SERVED", "CANCELLED"]),
  reason: z.string().trim().min(1).max(200).optional(),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
