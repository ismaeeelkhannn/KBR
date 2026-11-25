import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { FinanceError } from "@/modules/finance/finance.service";

export async function getPosCatalog(userId: string, branchId: string) {
  if (!(await userHasPermission(userId, "orders.create"))) {
    throw new FinanceError(403, "Order banane ki permission nahi hai");
  }
  if (!(await userCanAccessBranch(userId, branchId))) {
    throw new FinanceError(403, "Is branch ki access nahi hai");
  }

  const now = new Date();
  const categories = await db.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        where: { isActive: true, deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          variants: {
            where: { isActive: true, deletedAt: null },
            orderBy: { name: "asc" },
            include: {
              prices: {
                where: { effectiveFrom: { lte: now } },
                orderBy: { effectiveFrom: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      products: category.products
        .map((product) => ({
          id: product.id,
          name: product.name,
          variants: product.variants.flatMap((variant) => {
            const price = variant.prices[0];
            return price
              ? [
                  {
                    id: variant.id,
                    code: variant.code,
                    name: variant.name,
                    pricePaisa: price.amountPaisa,
                    isVerified: price.isVerified,
                  },
                ]
              : [];
          }),
        }))
        .filter((product) => product.variants.length > 0),
    }))
    .filter((category) => category.products.length > 0);
}
