import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";

export class CashError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CashError";
    this.status = status;
  }
}

/** Register par shift kholta hai. Ek register par ek waqt mein sirf ek OPEN shift. */
export async function openShift(
  userId: string,
  input: { cashRegisterId: string; openingCashPaisa: number }
) {
  if (!(await userHasPermission(userId, "cash.manage"))) {
    throw new CashError("Cash shift kholne ki ijazat nahi", 403);
  }
  if (
    !Number.isInteger(input.openingCashPaisa) ||
    input.openingCashPaisa < 0
  ) {
    throw new CashError("Opening cash ghalat hai", 400);
  }

  return db.$transaction(async (tx) => {
    const [register] = await tx.$queryRaw<
      { id: string; branchId: string; isActive: boolean }[]
    >`
      SELECT "id", "branchId", "isActive"
      FROM "CashRegister"
      WHERE "id" = ${input.cashRegisterId}
      FOR UPDATE
    `;

    if (!register || !register.isActive) {
      throw new CashError("Register mojood nahi ya band hai", 404);
    }

    const access = await tx.userBranchAccess.findUnique({
      where: {
        userId_branchId: { userId, branchId: register.branchId },
      },
      select: { userId: true },
    });
    if (!access) {
      throw new CashError("Is branch ka access aap ke paas nahi", 403);
    }

    const open = await tx.cashShift.findFirst({
      where: { cashRegisterId: register.id, status: "OPEN" },
      select: { id: true },
    });
    if (open) {
      throw new CashError("Is register par pehle se ek shift khuli hai", 409);
    }

    const shift = await tx.cashShift.create({
      data: {
        branchId: register.branchId,
        cashRegisterId: register.id,
        openedById: userId,
        openingCashPaisa: input.openingCashPaisa,
      },
    });

    await writeAudit(tx, {
      actorId: userId,
      action: "CASH_SHIFT_OPENED",
      entityType: "CashShift",
      entityId: shift.id,
      after: { openingCashPaisa: input.openingCashPaisa },
    });

    return shift;
  });
}

/**
 * Shift band karta hai.
 * - expected = opening + cash payments (status COMPLETED)
 * - variance = counted - expected
 * - Farq ho to cash.reconcile permission aur wajah zaroori hai.
 */
export async function closeShift(
  userId: string,
  shiftId: string,
  input: { countedCashPaisa: number; varianceReason?: string }
) {
  if (!(await userHasPermission(userId, "cash.manage"))) {
    throw new CashError("Shift band karne ki ijazat nahi", 403);
  }
  if (!Number.isInteger(input.countedCashPaisa) || input.countedCashPaisa < 0) {
    throw new CashError("Counted cash ghalat hai", 400);
  }

  const varianceReason = input.varianceReason?.trim();

  return db.$transaction(async (tx) => {
    // Payment writes must lock this row too, so no payment can race with closing.
    const [shift] = await tx.$queryRaw<
      {
        id: string;
        branchId: string;
        openedById: string;
        status: "OPEN" | "CLOSED";
        openingCashPaisa: number;
      }[]
    >`
      SELECT "id", "branchId", "openedById", "status", "openingCashPaisa"
      FROM "CashShift"
      WHERE "id" = ${shiftId}
      FOR UPDATE
    `;

    if (!shift) throw new CashError("Shift nahi mili", 404);
    if (shift.status !== "OPEN") {
      throw new CashError("Shift pehle se band hai", 409);
    }
    if (shift.openedById !== userId) {
      throw new CashError(
        "Sirf shift kholne wala cashier hi band kar sakta hai",
        403
      );
    }

    const access = await tx.userBranchAccess.findUnique({
      where: { userId_branchId: { userId, branchId: shift.branchId } },
      select: { userId: true },
    });
    if (!access) {
      throw new CashError("Is branch ka access aap ke paas nahi", 403);
    }

    const agg = await tx.payment.aggregate({
      where: {
        cashShiftId: shift.id,
        method: "CASH",
        status: "COMPLETED",
      },
      _sum: { amountPaisa: true },
    });
    const cashSales = agg._sum.amountPaisa ?? 0;
    const expectedCashPaisa = shift.openingCashPaisa + cashSales;
    const variancePaisa = input.countedCashPaisa - expectedCashPaisa;

    if (variancePaisa !== 0) {
      if (!(await userHasPermission(userId, "cash.reconcile"))) {
        throw new CashError(
          "Cash farq ho to cash.reconcile permission chahiye",
          403
        );
      }
      if (!varianceReason) {
        throw new CashError("Cash farq ki wajah likhna zaroori hai", 422);
      }
    }

    const moved = await tx.cashShift.updateMany({
      where: { id: shift.id, status: "OPEN" },
      data: {
        status: "CLOSED",
        closedById: userId,
        expectedCashPaisa,
        countedCashPaisa: input.countedCashPaisa,
        variancePaisa,
        varianceReason: varianceReason ?? null,
        closedAt: new Date(),
      },
    });
    if (moved.count === 0) {
      throw new CashError("Shift abhi band ho gayi. Refresh karein.", 409);
    }

    await writeAudit(tx, {
      actorId: userId,
      action: "CASH_SHIFT_CLOSED",
      entityType: "CashShift",
      entityId: shift.id,
      before: {
        status: "OPEN",
        openingCashPaisa: shift.openingCashPaisa,
      },
      after: {
        expectedCashPaisa,
        countedCashPaisa: input.countedCashPaisa,
        variancePaisa,
      },
      reason: varianceReason ?? null,
    });

    return tx.cashShift.findUniqueOrThrow({ where: { id: shift.id } });
  });
}
