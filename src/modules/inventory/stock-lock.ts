import { Prisma } from "@prisma/client";

export async function lockInventoryItems(
  tx: Prisma.TransactionClient,
  ids: string[]
) {
  const unique = [...new Set(ids)].sort();
  if (unique.length === 0) {
    return;
  }

  await tx.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "InventoryItem"
    WHERE "id" IN (${Prisma.join(unique)})
    ORDER BY "id"
    FOR UPDATE
  `;
}
