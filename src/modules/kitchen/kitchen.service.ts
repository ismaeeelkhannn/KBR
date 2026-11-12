import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { ACTIVE_KITCHEN_STATUSES, ALLOWED_TRANSITIONS } from "./status";

export class KitchenError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KitchenError";
    this.status = status;
  }
}

/** User jin branches ka access rakhta hai (sirf active branches) */
async function accessibleBranchIds(userId: string): Promise<string[]> {
  const rows = await db.userBranchAccess.findMany({
    where: { userId, branch: { isActive: true, deletedAt: null } },
    select: { branchId: true },
  });
  return rows.map((row) => row.branchId);
}

/** Kitchen ke liye active orders, purane pehle */
export async function listKitchenOrders(userId: string) {
  if (!(await userHasPermission(userId, "kitchen.view"))) {
    throw new KitchenError("Kitchen dekhne ki ijazat nahi", 403);
  }

  const branchIds = await accessibleBranchIds(userId);

  return db.order.findMany({
    where: {
      branchId: { in: branchIds },
      status: { in: ACTIVE_KITCHEN_STATUSES },
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });
}

/**
 * Order ka status badalta hai.
 * - Permission, branch access aur transition, teeno server par check hote hain.
 * - Optimistic lock: update sirf tab hota hai jab status wahi ho jo humne padha tha.
 *   Do log ek saath badlein to ek ko 409 milega, dono ka change nahi hoga.
 * - Status change aur history ek transaction mein save hote hain.
 */
export async function changeOrderStatus(
  userId: string,
  orderId: string,
  to: OrderStatus,
  reason?: string
) {
  if (!(await userHasPermission(userId, "kitchen.update"))) {
    throw new KitchenError("Status badalne ki ijazat nahi", 403);
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, branchId: true, status: true },
  });
  if (!order) {
    throw new KitchenError("Order nahi mila", 404);
  }

  if (!(await userCanAccessBranch(userId, order.branchId))) {
    throw new KitchenError("Is branch ka access aap ke paas nahi", 403);
  }

  if (!ALLOWED_TRANSITIONS[order.status].includes(to)) {
    throw new KitchenError(
      `${order.status} se ${to} mein status change allowed nahi`,
      409
    );
  }

  return db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to },
    });

    if (result.count === 0) {
      throw new KitchenError(
        "Order ka status abhi badal gaya. Refresh karein.",
        409
      );
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: to,
        changedById: userId,
        reason: reason ?? null,
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });
  });
}
