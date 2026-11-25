import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userHasPermission,
  userCanAccessBranch,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { enqueueEvent } from "@/modules/outbox/outbox";
import type { ExpenseInput, PurchaseInput } from "./finance.schemas";

const MAX_INT = 2_147_483_647;

export class FinanceError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "FinanceError";
  }
}

async function assertAccess(
  userId: string,
  branchId: string,
  permission: string
) {
  if (!(await userHasPermission(userId, permission))) {
    throw new FinanceError(403, "Is kaam ki permission nahi hai");
  }
  if (!(await userCanAccessBranch(userId, branchId))) {
    throw new FinanceError(403, "Is branch ki access nahi hai");
  }
}

function assertReplayOwner(
  existing: { createdById: string; branchId: string },
  userId: string,
  branchId: string
) {
  if (existing.createdById !== userId) {
    throw new FinanceError(409, "Ye idempotency key kisi aur user ki hai");
  }
  if (existing.branchId !== branchId) {
    throw new FinanceError(
      409,
      "Ye idempotency key kisi aur branch/request ke liye use ho chuki hai"
    );
  }
}

export async function createPurchase(userId: string, input: PurchaseInput) {
  await assertAccess(userId, input.branchId, "inventory.manage");

  const existing = await db.purchase.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { lines: true },
  });
  if (existing) {
    assertReplayOwner(existing, userId, input.branchId);
    return { purchase: existing, replayed: true };
  }

  const itemIds = [...new Set(input.lines.map((line) => line.inventoryItemId))];
  const found = await db.inventoryItem.count({
    where: { id: { in: itemIds } },
  });
  if (found !== itemIds.length) {
    throw new FinanceError(422, "Kuch inventory item maujood nahi");
  }

  const totalPaisa = input.lines.reduce(
    (sum, line) => sum + line.lineTotalPaisa,
    0
  );
  if (!Number.isSafeInteger(totalPaisa) || totalPaisa > MAX_INT) {
    throw new FinanceError(422, "Purchase total allowed limit se zyada hai");
  }

  try {
    const purchase = await db.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          branchId: input.branchId,
          supplierName: input.supplierName,
          invoiceNo: input.invoiceNo,
          totalPaisa,
          idempotencyKey: input.idempotencyKey,
          createdById: userId,
          lines: {
            create: input.lines.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              quantityBase: line.quantityBase,
              lineTotalPaisa: line.lineTotalPaisa,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.stockMovement.createMany({
        data: input.lines.map((line) => ({
          branchId: input.branchId,
          inventoryItemId: line.inventoryItemId,
          type: "PURCHASE" as const,
          quantityBase: line.quantityBase,
          reason: `Purchase ${created.id}`,
          createdById: userId,
        })),
      });

      await writeAudit(tx, {
        actorId: userId,
        action: "PURCHASE_RECORDED",
        entityType: "Purchase",
        entityId: created.id,
        after: { totalPaisa, lines: input.lines.length },
      });
      await enqueueEvent(tx, "purchase.recorded", {
        purchaseId: created.id,
        totalPaisa,
      });
      return created;
    });

    return { purchase, replayed: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await db.purchase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true },
      });
      if (again) {
        assertReplayOwner(again, userId, input.branchId);
        return { purchase: again, replayed: true };
      }
    }
    throw error;
  }
}

export async function createExpense(userId: string, input: ExpenseInput) {
  await assertAccess(userId, input.branchId, "expenses.manage");

  const existing = await db.expense.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    assertReplayOwner(existing, userId, input.branchId);
    return { expense: existing, replayed: true };
  }

  try {
    const expense = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          branchId: input.branchId,
          category: input.category,
          description: input.description,
          amountPaisa: input.amountPaisa,
          expenseDate: new Date(input.expenseDate),
          idempotencyKey: input.idempotencyKey,
          createdById: userId,
        },
      });
      await writeAudit(tx, {
        actorId: userId,
        action: "EXPENSE_RECORDED",
        entityType: "Expense",
        entityId: created.id,
        after: { amountPaisa: created.amountPaisa, category: created.category },
      });
      return created;
    });

    return { expense, replayed: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await db.expense.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (again) {
        assertReplayOwner(again, userId, input.branchId);
        return { expense: again, replayed: true };
      }
    }
    throw error;
  }
}

