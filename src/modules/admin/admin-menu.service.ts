import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { FinanceError } from "@/modules/finance/finance.service";
import type {
  MenuCategoryCreateInput,
  MenuCategoryUpdateInput,
  MenuProductCreateInput,
  MenuProductUpdateInput,
  MenuVariantCreateInput,
  MenuVariantUpdateInput,
} from "./admin-menu.schemas";

async function assertCanManageMenu(userId: string) {
  if (!(await userHasPermission(userId, "settings.manage"))) {
    throw new FinanceError(403, "Menu manage karne ki permission nahi hai");
  }
}

function mapUniqueConflict(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new FinanceError(409, message);
    if (error.code === "P2034") {
      throw new FinanceError(409, "Catalog data badal gaya; dobara try karein");
    }
  }
  throw error;
}

async function assertCategoryExists(
  tx: Prisma.TransactionClient,
  categoryId: string,
) {
  const category = await tx.category.findFirst({
    where: { id: categoryId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!category) throw new FinanceError(422, "Active category nahi mili");
}

async function assertCategoryCodeAvailable(
  tx: Prisma.TransactionClient,
  code: string,
) {
  const exists = await tx.category.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) throw new FinanceError(409, "Category code pehle se use ho raha hai");
}

async function assertProductCodeAvailable(
  tx: Prisma.TransactionClient,
  code: string,
) {
  const exists = await tx.product.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) throw new FinanceError(409, "Product code pehle se use ho raha hai");
}

async function assertVariantCodeAvailable(
  tx: Prisma.TransactionClient,
  code: string,
) {
  const exists = await tx.productVariant.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
    select: { id: true },
  });
  if (exists) throw new FinanceError(409, "Item code pehle se use ho raha hai");
}

export async function getAdminMenu(userId: string) {
  await assertCanManageMenu(userId);
  const now = new Date();
  const categories = await db.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      sortOrder: true,
      isActive: true,
      products: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isActive: true,
          variants: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
              prices: {
                where: { effectiveFrom: { lte: now } },
                orderBy: { effectiveFrom: "desc" },
                take: 1,
                select: {
                  amountPaisa: true,
                  isVerified: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return categories.map((category) => ({
    ...category,
    products: category.products.map((product) => ({
      ...product,
      categoryId: category.id,
      categoryName: category.name,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        code: variant.code,
        name: variant.name,
        isActive: variant.isActive,
        pricePaisa: variant.prices[0]?.amountPaisa ?? null,
        priceVerified: variant.prices[0]?.isVerified ?? false,
      })),
    })),
  }));
}

export async function createMenuCategory(
  actorId: string,
  input: MenuCategoryCreateInput,
) {
  await assertCanManageMenu(actorId);
  try {
    return await db.$transaction(
      async (tx) => {
        await assertCategoryCodeAvailable(tx, input.code);
        const latest = await tx.category.aggregate({
          _max: { sortOrder: true },
        });
        const category = await tx.category.create({
          data: {
            code: input.code,
            name: input.name,
            sortOrder: (latest._max.sortOrder ?? 0) + 1,
          },
          select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
        });
        await writeAudit(tx, {
          actorId,
          action: "MENU_CATEGORY_CREATED",
          entityType: "Category",
          entityId: category.id,
          after: {
            code: category.code,
            name: category.name,
            sortOrder: category.sortOrder,
          },
        });
        return category;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    mapUniqueConflict(error, "Category code pehle se use ho raha hai");
  }
}

export async function updateMenuCategory(
  actorId: string,
  categoryId: string,
  input: MenuCategoryUpdateInput,
) {
  await assertCanManageMenu(actorId);
  return db.$transaction(
    async (tx) => {
      const before = await tx.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
      });
      if (!before) throw new FinanceError(404, "Category nahi mili");

      const category = await tx.category.update({
        where: { id: categoryId },
        data: input,
        select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
      });
      await writeAudit(tx, {
        actorId,
        action: "MENU_CATEGORY_UPDATED",
        entityType: "Category",
        entityId: category.id,
        before: {
          code: before.code,
          name: before.name,
          sortOrder: before.sortOrder,
          isActive: before.isActive,
        },
        after: {
          code: category.code,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
        },
      });
      return category;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createMenuProduct(
  actorId: string,
  input: MenuProductCreateInput,
) {
  await assertCanManageMenu(actorId);
  try {
    return await db.$transaction(
      async (tx) => {
        await assertCategoryExists(tx, input.categoryId);
        await assertProductCodeAvailable(tx, input.code);
        for (const variant of input.variants) {
          await assertVariantCodeAvailable(tx, variant.code);
        }

        const product = await tx.product.create({
          data: {
            code: input.code,
            name: input.name,
            description: input.description ?? null,
            categoryId: input.categoryId,
          },
          select: { id: true, code: true, name: true, categoryId: true },
        });

        const variants = [];
        for (const inputVariant of input.variants) {
          const variant = await tx.productVariant.create({
            data: {
              code: inputVariant.code,
              name: inputVariant.name,
              productId: product.id,
              prices: {
                create: {
                  amountPaisa: inputVariant.pricePaisa,
                  isVerified: true,
                  note: "Admin menu entry",
                },
              },
            },
            select: { id: true, code: true, name: true },
          });
          variants.push(variant);
        }

        await writeAudit(tx, {
          actorId,
          action: "MENU_PRODUCT_CREATED",
          entityType: "Product",
          entityId: product.id,
          after: {
            code: product.code,
            name: product.name,
            categoryId: product.categoryId,
            variants: variants.map(({ code, name }) => ({ code, name })),
          },
        });
        return { ...product, variants };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    mapUniqueConflict(error, "Product ya item code pehle se use ho raha hai");
  }
}

export async function updateMenuProduct(
  actorId: string,
  productId: string,
  input: MenuProductUpdateInput,
) {
  await assertCanManageMenu(actorId);
  return db.$transaction(
    async (tx) => {
      const before = await tx.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          description: true,
          isActive: true,
        },
      });
      if (!before) throw new FinanceError(404, "Product nahi mila");
      if (input.categoryId) await assertCategoryExists(tx, input.categoryId);

      const product = await tx.product.update({
        where: { id: productId },
        data: input,
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          description: true,
          isActive: true,
        },
      });
      await writeAudit(tx, {
        actorId,
        action: "MENU_PRODUCT_UPDATED",
        entityType: "Product",
        entityId: product.id,
        before: {
          code: before.code,
          name: before.name,
          categoryId: before.categoryId,
          description: before.description,
          isActive: before.isActive,
        },
        after: {
          code: product.code,
          name: product.name,
          categoryId: product.categoryId,
          description: product.description,
          isActive: product.isActive,
        },
      });
      return product;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createMenuVariant(
  actorId: string,
  productId: string,
  input: MenuVariantCreateInput,
) {
  await assertCanManageMenu(actorId);
  try {
    return await db.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: {
            id: productId,
            isActive: true,
            deletedAt: null,
            category: { isActive: true, deletedAt: null },
          },
          select: { id: true },
        });
        if (!product) throw new FinanceError(404, "Active product nahi mila");
        await assertVariantCodeAvailable(tx, input.code);

        const variant = await tx.productVariant.create({
          data: {
            code: input.code,
            name: input.name,
            productId,
            prices: {
              create: {
                amountPaisa: input.pricePaisa,
                isVerified: true,
                note: "Admin menu entry",
              },
            },
          },
          select: { id: true, code: true, name: true },
        });
        await writeAudit(tx, {
          actorId,
          action: "MENU_VARIANT_CREATED",
          entityType: "ProductVariant",
          entityId: variant.id,
          after: {
            productId,
            code: variant.code,
            name: variant.name,
            pricePaisa: input.pricePaisa,
          },
        });
        return variant;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    mapUniqueConflict(error, "Item code pehle se use ho raha hai");
  }
}

export async function updateMenuVariant(
  actorId: string,
  variantId: string,
  input: MenuVariantUpdateInput,
) {
  await assertCanManageMenu(actorId);
  return db.$transaction(
    async (tx) => {
      const now = new Date();
      const before = await tx.productVariant.findFirst({
        where: { id: variantId, deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          prices: {
            where: { effectiveFrom: { lte: now } },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: { amountPaisa: true, isVerified: true },
          },
        },
      });
      if (!before) throw new FinanceError(404, "Menu item nahi mila");

      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: { id: true, code: true, name: true, isActive: true },
      });
      const currentPrice = before.prices[0];
      const shouldCreatePrice =
        input.pricePaisa !== undefined &&
        (currentPrice?.amountPaisa !== input.pricePaisa ||
          currentPrice?.isVerified === false);

      if (shouldCreatePrice && input.pricePaisa !== undefined) {
        await tx.priceVersion.create({
          data: {
            variantId,
            amountPaisa: input.pricePaisa,
            isVerified: true,
            note: "Admin menu price update",
          },
        });
      }

      const nextPricePaisa =
        shouldCreatePrice && input.pricePaisa !== undefined
        ? input.pricePaisa
        : (currentPrice?.amountPaisa ?? null);
      const nextPriceVerified = shouldCreatePrice
        ? true
        : (currentPrice?.isVerified ?? false);
      await writeAudit(tx, {
        actorId,
        action: shouldCreatePrice ? "MENU_PRICE_UPDATED" : "MENU_VARIANT_UPDATED",
        entityType: "ProductVariant",
        entityId: variantId,
        before: {
          code: before.code,
          name: before.name,
          isActive: before.isActive,
          pricePaisa: currentPrice?.amountPaisa ?? null,
          priceVerified: currentPrice?.isVerified ?? false,
        },
        after: {
          code: variant.code,
          name: variant.name,
          isActive: variant.isActive,
          pricePaisa: nextPricePaisa,
          priceVerified: nextPriceVerified,
        },
      });
      return {
        ...variant,
        pricePaisa: nextPricePaisa,
        priceVerified: nextPriceVerified,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
