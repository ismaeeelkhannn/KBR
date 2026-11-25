import { z } from "zod";

const code = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9._-]+$/)
  .transform((value) => value.toUpperCase());

const name = z.string().trim().min(2).max(120);
const pricePaisa = z.number().int().positive().max(2_000_000_000);

export const menuCategoryCreateSchema = z.object({
  code,
  name,
});

export const menuCategoryUpdateSchema = z
  .object({
    name: name.optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Kam az kam ek field do");

const variantCreate = z.object({
  code,
  name,
  pricePaisa,
});

export const menuProductCreateSchema = z.object({
  categoryId: z.string().min(1),
  code,
  name,
  description: z.string().trim().max(500).nullable().optional(),
  variants: z.array(variantCreate).min(1).max(20).refine(
    (variants) =>
      new Set(variants.map((variant) => variant.code.toLowerCase())).size ===
      variants.length,
    "Variant codes unique hone chahiye",
  ),
});

export const menuProductUpdateSchema = z
  .object({
    categoryId: z.string().min(1).optional(),
    name: name.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Kam az kam ek field do");

export const menuVariantCreateSchema = variantCreate;

export const menuVariantUpdateSchema = z
  .object({
    name: name.optional(),
    pricePaisa: pricePaisa.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Kam az kam ek field do");

export type MenuCategoryCreateInput = z.infer<typeof menuCategoryCreateSchema>;
export type MenuCategoryUpdateInput = z.infer<typeof menuCategoryUpdateSchema>;
export type MenuProductCreateInput = z.infer<typeof menuProductCreateSchema>;
export type MenuProductUpdateInput = z.infer<typeof menuProductUpdateSchema>;
export type MenuVariantCreateInput = z.infer<typeof menuVariantCreateSchema>;
export type MenuVariantUpdateInput = z.infer<typeof menuVariantUpdateSchema>;
