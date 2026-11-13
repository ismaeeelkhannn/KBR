import { z } from "zod";

export const changeStatusSchema = z.object({
  to: z.enum(["PREPARING", "READY", "SERVED"]),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
