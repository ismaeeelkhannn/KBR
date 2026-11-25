import { z } from "zod";

const username = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/)
  .transform((value) => value.toLowerCase());

const branchIds = z
  .array(z.string().min(1))
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length);

export const adminUserCreateSchema = z.object({
  username,
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(256),
  roleId: z.string().min(1),
  branchIds,
});

export const adminUserUpdateSchema = z
  .object({
    username: username.optional(),
    fullName: z.string().trim().min(2).max(100).optional(),
    password: z.string().min(12).max(256).optional(),
    roleId: z.string().min(1).optional(),
    branchIds: branchIds.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Kam az kam ek field do");

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
