import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(1).max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
