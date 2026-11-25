import { z } from "zod";

export const rolePermissionsUpdateSchema = z.object({
  permissionIds: z
    .array(z.string().min(1))
    .max(200)
    .refine((values) => new Set(values).size === values.length),
});

export type RolePermissionsUpdateInput = z.infer<
  typeof rolePermissionsUpdateSchema
>;
