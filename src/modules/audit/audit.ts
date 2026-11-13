import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Audit entry. Ye hamesha transaction (tx) ke andar likhi jati hai,
 * taake business change aur audit ek saath save hon ya dono rollback hon.
 */
export async function writeAudit(
  tx: Tx,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    reason?: string | null;
  }
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      reason: input.reason ?? null,
    },
  });
}
