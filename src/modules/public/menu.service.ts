import { db } from "@/lib/db";

export async function getPublicMenu() {
  const now = new Date();

  const categories = await db.category.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      NOT: { code: { startsWith: "DEMO-" } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: {
          isActive: true,
          deletedAt: null,
          NOT: { code: { startsWith: "DEMO-" } },
        },
        orderBy: { name: "asc" },
        include: {
          variants: {
            where: {
              isActive: true,
              deletedAt: null,
              NOT: { code: { startsWith: "DEMO-" } },
            },
            orderBy: { name: "asc" },
            include: {
              prices: {
                where: { isVerified: true, effectiveFrom: { lte: now } },
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
          description: product.description,
          variants: product.variants.flatMap((variant) => {
            const price = variant.prices[0];
            return price
              ? [
                  {
                    id: variant.id,
                    name: variant.name,
                    pricePaisa: price.amountPaisa,
                  },
                ]
              : [];
          }),
        }))
        .filter((product) => product.variants.length > 0),
    }))
    .filter((category) => category.products.length > 0);
}
