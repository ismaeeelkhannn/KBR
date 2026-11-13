import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { enqueueEvent } from "@/modules/outbox/outbox";
import { CANCELLABLE_STATUSES } from "@/modules/kitchen/status";

export class ApprovalError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApprovalError";
    this.status = status;
  }
}

/**
 * Cancel request banata hai. Order abhi cancel nahi hota.
 * Order status, approval, audit aur outbox ek transaction mein.
 */
export async function requestOrderCancel(
  userId: string,
  orderId: string,
  reason: string
) {
  if (!(await userHasPermission(userId, "orders.cancel.request"))) {
    throw new ApprovalError("Cancel request karne ki ijazat nahi", 403);
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, branchId: true, status: true },
  });
  if (!order) throw new ApprovalError("Order nahi mila", 404);

  if (!(await userCanAccessBranch(userId, order.branchId))) {
    throw new ApprovalError("Is branch ka access aap ke paas nahi", 403);
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new ApprovalError(`${order.status} order cancel nahi ho sakta`, 409);
  }

  const pending = await db.approval.findFirst({
    where: { entityType: "Order", entityId: orderId, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    throw new ApprovalError(
      "Is order ki cancel request pehle se pending hai",
      409
    );
  }

  return db.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        type: "ORDER_CANCEL",
        entityType: "Order",
        entityId: orderId,
        reason,
        requestedById: userId,
      },
    });

    await writeAudit(tx, {
      actorId: userId,
      action: "ORDER_CANCEL_REQUESTED",
      entityType: "Order",
      entityId: orderId,
      before: { status: order.status },
      after: { approvalId: approval.id },
      reason,
    });

    await enqueueEvent(tx, "approval.requested", {
      approvalId: approval.id,
      orderId,
      branchId: order.branchId,
      requestedById: userId,
      reason,
    });

    return approval;
  });
}

/** Pending approvals jo is user ki branches ke hain */
export async function listPendingApprovals(userId: string) {
  if (!(await userHasPermission(userId, "orders.cancel.approve"))) {
    throw new ApprovalError("Approvals dekhne ki ijazat nahi", 403);
  }

  const approvals = await db.approval.findMany({
    where: { status: "PENDING", entityType: "Order" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  const result = [];
  for (const approval of approvals) {
    const order = await db.order.findUnique({
      where: { id: approval.entityId },
      select: { branchId: true, orderNumber: true, status: true, totalPaisa: true },
    });
    if (order && (await userCanAccessBranch(userId, order.branchId))) {
      result.push({ ...approval, order });
    }
  }
  return result;
}

/**
 * Approval ka faisla.
 * - Requester khud approve nahi kar sakta (maker-checker).
 * - APPROVED par order CANCELLED hota hai, aur history record banti hai.
 * - Sab kuch ek transaction mein.
 */
export async function decideApproval(
  userId: string,
  approvalId: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
) {
  if (!(await userHasPermission(userId, "orders.cancel.approve"))) {
    throw new ApprovalError("Approve karne ki ijazat nahi", 403);
  }

  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) throw new ApprovalError("Approval nahi mili", 404);

  if (approval.status !== "PENDING") {
    throw new ApprovalError("Ye request pehle se decide ho chuki hai", 409);
  }

  if (approval.requestedById === userId) {
    throw new ApprovalError("Apni request khud approve nahi kar sakte", 403);
  }

  const order = await db.order.findUnique({
    where: { id: approval.entityId },
    select: { id: true, branchId: true },
  });
  if (!order) throw new ApprovalError("Related order nahi mila", 404);

  if (!(await userCanAccessBranch(userId, order.branchId))) {
    throw new ApprovalError("Is branch ka access aap ke paas nahi", 403);
  }

  return db.$transaction(async (tx) => {
    // Optimistic lock: sirf PENDING ko decide kar sakte hain
    const moved = await tx.approval.updateMany({
      where: { id: approvalId, status: "PENDING" },
      data: {
        status: decision,
        decidedById: userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    });
    if (moved.count === 0) {
      throw new ApprovalError(
        "Ye request abhi decide ho gayi. Refresh karein.",
        409
      );
    }

    if (decision === "APPROVED") {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });

      if (!CANCELLABLE_STATUSES.includes(current.status)) {
        throw new ApprovalError(
          `${current.status} order ab cancel nahi ho sakta`,
          409
        );
      }

      const cancelled = await tx.order.updateMany({
        where: { id: order.id, status: current.status },
        data: { status: "CANCELLED" },
      });
      if (cancelled.count === 0) {
        throw new ApprovalError(
          "Order ka status abhi badal gaya. Refresh karein.",
          409
        );
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: current.status,
          toStatus: "CANCELLED",
          changedById: userId,
          reason: approval.reason,
        },
      });

      await writeAudit(tx, {
        actorId: userId,
        action: "ORDER_CANCELLED",
        entityType: "Order",
        entityId: order.id,
        before: { status: current.status },
        after: { status: "CANCELLED", approvalId },
        reason: approval.reason,
      });
    }

    await writeAudit(tx, {
      actorId: userId,
      action: `APPROVAL_${decision}`,
      entityType: "Approval",
      entityId: approvalId,
      after: { decision },
      reason: note ?? null,
    });

    await enqueueEvent(tx, "approval.decided", {
      approvalId,
      orderId: order.id,
      decision,
      decidedById: userId,
    });

    return tx.approval.findUniqueOrThrow({ where: { id: approvalId } });
  });
}
