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
