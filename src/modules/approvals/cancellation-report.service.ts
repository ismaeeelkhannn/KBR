import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { userHasPermission } from "@/modules/access-control/permissions";
import { CANCELLABLE_STATUSES } from "@/modules/kitchen/status";
import { CANCELLATION_REASON_LABELS } from "./approval.schemas";
import { ApprovalError } from "./approval.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function karachiPeriodStarts(now: Date) {
  const local = new Date(now.getTime() + KARACHI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const localMidnight = Date.UTC(year, month, day) - KARACHI_OFFSET_MS;
  const dayOfWeek = local.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  return {
    today: new Date(localMidnight),
    week: new Date(localMidnight - daysSinceMonday * DAY_MS),
    month: new Date(Date.UTC(year, month, 1) - KARACHI_OFFSET_MS),
  };
}

async function getAccessibleBranchIds(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: { select: { code: true } } },
  });
  if (!user) throw new ApprovalError("User nahi mila", 404);

  if (user.role.code === "OWNER") {
    const branches = await db.branch.findMany({ select: { id: true } });
    return branches.map((branch) => branch.id);
  }

  const access = await db.userBranchAccess.findMany({
    where: { userId },
    select: { branchId: true },
  });
  return access.map((item) => item.branchId);
}

function eventQuery(
  branchIds: string[],
  options: { start?: Date; end?: Date; orderIds?: string[]; limit?: number } = {}
) {
  return db.orderStatusEvent.findMany({
    where: {
      toStatus: "CANCELLED",
      ...(options.start || options.end
        ? {
            createdAt: {
              ...(options.start ? { gte: options.start } : {}),
              ...(options.end ? { lt: options.end } : {}),
            },
          }
        : {}),
      order: {
        branchId: { in: branchIds },
        ...(options.orderIds ? { id: { in: options.orderIds } } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    ...(options.limit ? { take: options.limit } : {}),
    select: {
      id: true,
      orderId: true,
      createdAt: true,
      reason: true,
      changedBy: { select: { fullName: true } },
      order: {
        select: {
          orderNumber: true,
          customerName: true,
          totalPaisa: true,
          items: {
            select: {
              productNameSnapshot: true,
              variantNameSnapshot: true,
              quantity: true,
            },
          },
        },
      },
    },
  });
}

type CancellationEvent = Awaited<ReturnType<typeof eventQuery>>[number];

export async function listCancellableOrders(userId: string) {
  const [canRequestCancellation, canManageDelivery, user, branchIds] =
    await Promise.all([
      userHasPermission(userId, "orders.cancel.request"),
      userHasPermission(userId, "delivery.manage"),
      db.user.findUnique({
        where: { id: userId },
        select: { role: { select: { code: true } } },
      }),
      getAccessibleBranchIds(userId),
    ]);

  if (
    !user ||
    (user.role.code === "DELIVERY"
      ? !canManageDelivery
      : !canRequestCancellation)
  ) {
    throw new ApprovalError("Cancel request karne ki ijazat nahi", 403);
  }
  if (branchIds.length === 0) {
    throw new ApprovalError("Is user ke liye koi branch access nahi", 403);
  }

  const assignedDeliveries =
    user.role.code === "DELIVERY"
      ? await db.deliveryDetail.findMany({
          where: {
            branchId: { in: branchIds },
            riderUserId: userId,
            status: { in: ["PENDING", "DISPATCHED"] },
          },
          select: { orderId: true },
        })
      : null;
  const assignedOrderIds = assignedDeliveries?.map((item) => item.orderId);
  if (assignedOrderIds && assignedOrderIds.length === 0) return [];

  const allowedStatuses: OrderStatus[] = assignedOrderIds
    ? [...CANCELLABLE_STATUSES, "SERVED"]
    : CANCELLABLE_STATUSES;
  const orders = await db.order.findMany({
    where: {
      branchId: { in: branchIds },
      status: { in: allowedStatuses },
      ...(assignedOrderIds ? { id: { in: assignedOrderIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      totalPaisa: true,
      createdAt: true,
      items: {
        select: {
          productNameSnapshot: true,
          variantNameSnapshot: true,
          quantity: true,
        },
      },
    },
  });
  if (orders.length === 0) return [];

  const pending = await db.approval.findMany({
    where: {
      type: "ORDER_CANCEL",
      entityType: "Order",
      status: "PENDING",
      entityId: { in: orders.map((order) => order.id) },
    },
    select: { entityId: true },
  });
  const pendingIds = new Set(pending.map((approval) => approval.entityId));
  const eligible = orders.filter((order) => !pendingIds.has(order.id));
  return user.role.code === "DELIVERY"
    ? eligible.map((order) => ({ ...order, totalPaisa: null }))
    : eligible;
}

export async function getCancellationReport(userId: string) {
  const [hasReportPermission, canRequestCancellation, canManageDelivery, user] =
    await Promise.all([
      userHasPermission(userId, "reports.view"),
      userHasPermission(userId, "orders.cancel.request"),
      userHasPermission(userId, "delivery.manage"),
      db.user.findUnique({
        where: { id: userId },
        select: { role: { select: { code: true } } },
      }),
    ]);
  if (!user) throw new ApprovalError("User nahi mila", 404);
  const isDeliveryRole = user.role.code === "DELIVERY";
  const canViewAll = hasReportPermission && !isDeliveryRole;
  if (
    !canViewAll &&
    (isDeliveryRole ? !canManageDelivery : !canRequestCancellation)
  ) {
    throw new ApprovalError("Cancellation report dekhne ki ijazat nahi", 403);
  }

  const branchIds = await getAccessibleBranchIds(userId);
  if (branchIds.length === 0) {
    throw new ApprovalError("Is user ke liye koi branch access nahi", 403);
  }

  const now = new Date();
  const periods = karachiPeriodStarts(now);
  let ownMonthOrderIds: string[] | undefined;
  let ownWeekOrderIds: string[] | undefined;
  let ownRecentOrderIds: string[] | undefined;

  if (!canViewAll) {
    const [monthApprovals, weekApprovals, recentApprovals] = await Promise.all([
      db.approval.findMany({
        where: {
          type: "ORDER_CANCEL",
          entityType: "Order",
          status: "APPROVED",
          requestedById: userId,
          decidedAt: { gte: periods.month },
        },
        select: { entityId: true },
      }),
      db.approval.findMany({
        where: {
          type: "ORDER_CANCEL",
          entityType: "Order",
          status: "APPROVED",
          requestedById: userId,
          decidedAt: { gte: periods.week },
        },
        select: { entityId: true },
      }),
      db.approval.findMany({
        where: {
          type: "ORDER_CANCEL",
          entityType: "Order",
          status: "APPROVED",
          requestedById: userId,
        },
        orderBy: { decidedAt: "desc" },
        take: 100,
        select: { entityId: true },
      }),
    ]);
    ownMonthOrderIds = [...new Set(monthApprovals.map((item) => item.entityId))];
    ownWeekOrderIds = [...new Set(weekApprovals.map((item) => item.entityId))];
    ownRecentOrderIds = [...new Set(recentApprovals.map((item) => item.entityId))];
  }

  const [monthEvents, weekEvents, recentEvents, monthOrderCount] = await Promise.all([
    ownMonthOrderIds?.length === 0
      ? Promise.resolve<CancellationEvent[]>([])
      : eventQuery(branchIds, {
          start: periods.month,
          end: now,
          ...(ownMonthOrderIds ? { orderIds: ownMonthOrderIds } : {}),
        }),
    ownWeekOrderIds?.length === 0
      ? Promise.resolve<CancellationEvent[]>([])
      : eventQuery(branchIds, {
          start: periods.week,
          end: now,
          ...(ownWeekOrderIds ? { orderIds: ownWeekOrderIds } : {}),
        }),
    ownRecentOrderIds?.length === 0
      ? Promise.resolve<CancellationEvent[]>([])
      : eventQuery(branchIds, {
          limit: 100,
          ...(ownRecentOrderIds ? { orderIds: ownRecentOrderIds } : {}),
        }),
    canViewAll
      ? db.order.count({
          where: {
            branchId: { in: branchIds },
            createdAt: { gte: periods.month, lt: now },
          },
        })
      : Promise.resolve(null),
  ]);
  const dayEnd = new Date(periods.today.getTime() + DAY_MS);
  const todayEvents = monthEvents.filter(
    (event) => event.createdAt >= periods.today && event.createdAt < dayEnd
  );
  const orderIds = [...new Set(monthEvents.concat(recentEvents).map((event) => event.orderId))];
  const approvals = orderIds.length
    ? await db.approval.findMany({
        where: {
          type: "ORDER_CANCEL",
          entityType: "Order",
          status: "APPROVED",
          entityId: { in: orderIds },
          ...(canViewAll ? {} : { requestedById: userId }),
        },
        orderBy: { decidedAt: "desc" },
        include: {
          requestedBy: {
            select: {
              id: true,
              fullName: true,
              role: { select: { name: true } },
            },
          },
          decidedBy: { select: { fullName: true } },
        },
      })
    : [];
  const approvalByOrder = new Map(
    approvals.map((approval) => [approval.entityId, approval])
  );

  const reasonCounts = new Map<string, number>();
  const employeeCounts = new Map<string, { name: string; count: number }>();
  for (const event of monthEvents) {
    const approval = approvalByOrder.get(event.orderId);
    const reasonCode = approval?.reasonCode ?? "UNSPECIFIED";
    reasonCounts.set(reasonCode, (reasonCounts.get(reasonCode) ?? 0) + 1);
    const employeeId = approval?.requestedById ?? `unknown:${event.changedBy.fullName}`;
    const employee = employeeCounts.get(employeeId);
    employeeCounts.set(employeeId, {
      name: approval?.requestedBy.fullName ?? event.changedBy.fullName,
      count: (employee?.count ?? 0) + 1,
    });
  }

  const history = recentEvents.map((event) => {
    const approval = approvalByOrder.get(event.orderId);
    const reasonCode = approval?.reasonCode ?? null;
    return {
      id: event.id,
      orderNumber: event.order.orderNumber,
      customerName: event.order.customerName,
      items: event.order.items,
      totalPaisa: isDeliveryRole ? null : event.order.totalPaisa,
      reason: approval?.reason ?? event.reason ?? "Wajah record nahi hui",
      reasonCode,
      reasonLabel: reasonCode
        ? CANCELLATION_REASON_LABELS[reasonCode]
        : "Purana record / category nahi",
      cancelledBy: isDeliveryRole
        ? "You"
        : approval
          ? `${approval.requestedBy.fullName} (${approval.requestedBy.role.name})`
          : event.changedBy.fullName,
      approvedBy: isDeliveryRole
        ? "Authorized manager"
        : approval?.decidedBy?.fullName ?? event.changedBy.fullName,
      cancelledAt: event.createdAt.toISOString(),
    };
  });

  const reasons = [...reasonCounts.entries()]
    .map(([code, count]) => ({
      code,
      label:
        code === "UNSPECIFIED"
          ? "Purana record / category nahi"
          : Object.entries(CANCELLATION_REASON_LABELS).find(
              ([reasonCode]) => reasonCode === code
            )?.[1] ?? "Purana record / category nahi",
      count,
    }))
    .sort((left, right) => right.count - left.count);
  const employees = [...employeeCounts.values()].sort(
    (left, right) => right.count - left.count
  );

  return {
    canViewAll,
    metrics: {
      todayCount: todayEvents.length,
      todayValuePaisa: isDeliveryRole
        ? null
        : todayEvents.reduce(
            (sum, event) => sum + event.order.totalPaisa,
            0
          ),
      weekCount: weekEvents.length,
      monthCount: monthEvents.length,
      monthlyRate:
        monthOrderCount && monthOrderCount > 0
          ? Number(((monthEvents.length / monthOrderCount) * 100).toFixed(1))
          : null,
    },
    reasons,
    employees: isDeliveryRole ? [] : employees,
    history,
  };
}
