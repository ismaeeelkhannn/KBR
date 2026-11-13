import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Outbox event. Business change ke saath same transaction mein save hota hai.
 * Notification ka alag process (worker) isay bhejta hai.
 */
export async function enqueueEvent(
  tx: Tx,
  type: string,
  payload: Prisma.InputJsonValue
): Promise<void> {
  await tx.outboxEvent.create({ data: { type, payload } });
}
