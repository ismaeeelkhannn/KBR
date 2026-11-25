import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userHasPermission,
  userCanAccessBranch,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { FinanceError } from "@/modules/finance/finance.service";
import { closingDateDecision } from "./closing-date";

function dayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new FinanceError(400, "Date YYYY-MM-DD format mein do");
  }

  const start = new Date(`${date}T00:00:00+05:00`);
  if (
    Number.isNaN(start.getTime()) ||
    new Date(start.getTime() + 5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10) !== date
  ) {
    throw new FinanceError(400, "Date ghalat hai");
  }

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
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

async function buildReport(branchId: string, date: string) {
  const { start, end } = dayRange(date);
  const range = { gte: start, lt: end };

  const [payments, expenses, purchases, orders, cancellationEvents] =
    await Promise.all([
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: range, order: { branchId } },
      select: { method: true, amountPaisa: true },
    }),
    db.expense.aggregate({
      where: { branchId, expenseDate: range },
      _sum: { amountPaisa: true },
      _count: { _all: true },
    }),
    db.purchase.aggregate({
      where: { branchId, createdAt: range },
      _sum: { totalPaisa: true },
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["status"],
      where: { branchId, createdAt: range },
      _count: { _all: true },
    }),
    db.orderStatusEvent.findMany({
      where: {
        toStatus: "CANCELLED",
        createdAt: range,
        order: { branchId },
      },
      select: { order: { select: { totalPaisa: true } } },
    }),
  ]);

  const byMethod: Record<string, number> = {};
  for (const payment of payments) {
    byMethod[payment.method] =
      (byMethod[payment.method] ?? 0) + payment.amountPaisa;
  }

  const salesPaisa = payments.reduce(
    (sum, payment) => sum + payment.amountPaisa,
    0
  );
  const expensesPaisa = expenses._sum.amountPaisa ?? 0;
  const purchasesPaisa = purchases._sum.totalPaisa ?? 0;

  return {
    date,
    branchId,
    salesPaisa,
    expensesPaisa,
    purchasesPaisa,
    netPaisa: salesPaisa - expensesPaisa,
    sales: { count: payments.length, byMethod },
    expenses: { count: expenses._count._all },
    purchases: { count: purchases._count._all },
    cancellations: {
      count: cancellationEvents.length,
      totalPaisa: cancellationEvents.reduce(
        (sum, event) => sum + event.order.totalPaisa,
        0
      ),
    },
    orders: Object.fromEntries(
      orders.map((order) => [order.status, order._count._all])
    ),
  };
}

export async function getDailyReport(
  userId: string,
  branchId: string,
  date: string
) {
  await assertAccess(userId, branchId, "reports.view");
  return buildReport(branchId, date);
}

export async function closeDay(
  userId: string,
  branchId: string,
  date: string
) {
  await assertAccess(userId, branchId, "reports.close");
  dayRange(date);
  const dateDecision = closingDateDecision(
    date,
    new Date(),
    process.env.APP_TIMEZONE ?? "Asia/Karachi",
  );
  if (!dateDecision.allowed) throw new FinanceError(422, dateDecision.reason);

  const already = await db.dailyClosing.findUnique({
    where: { branchId_businessDate: { branchId, businessDate: date } },
  });
  if (already) {
    throw new FinanceError(409, `${date} pehle hi band ho chuka hai`);
  }

  const report = await buildReport(branchId, date);

  try {
    const closing = await db.$transaction(async (tx) => {
      const created = await tx.dailyClosing.create({
        data: {
          branchId,
          businessDate: date,
          salesPaisa: report.salesPaisa,
          expensesPaisa: report.expensesPaisa,
          purchasesPaisa: report.purchasesPaisa,
          snapshot: report,
          closedById: userId,
        },
      });
      await writeAudit(tx, {
        actorId: userId,
        action: "DAY_CLOSED",
        entityType: "DailyClosing",
        entityId: created.id,
        after: {
          date,
          salesPaisa: report.salesPaisa,
          expensesPaisa: report.expensesPaisa,
        },
      });
      return created;
    });

    return { closing, report };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FinanceError(409, `${date} pehle hi band ho chuka hai`);
    }
    throw error;
  }
}
