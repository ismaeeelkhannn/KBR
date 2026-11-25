import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { enqueueEvent } from "@/modules/outbox/outbox";
import { CANCELLABLE_STATUSES } from "@/modules/kitchen/status";
import { createWastageForOrder } from "@/modules/inventory/wastage.service";
import { isAssignedDeliveryRider } from "@/modules/operations/delivery-access";
import {
  CANCELLATION_REASON_LABELS,
  cancelRequestSchema,
} from "./approval.schemas";
import type { z } from "zod";

type CancelRequestInput = z.infer<typeof cancelRequestSchema>;

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
  input: CancelRequestInput
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, branchId: true, status: true, orderType: true },
  });
  if (!order) throw new ApprovalError("Order nahi mila", 404);

  if (!(await userCanAccessBranch(userId, order.branchId))) {
    throw new ApprovalError("Is branch ka access aap ke paas nahi", 403);
  }

  const [canRequestCancellation, canManageDelivery, user] = await Promise.all([
    userHasPermission(userId, "orders.cancel.request"),
    userHasPermission(userId, "delivery.manage"),
    db.user.findUnique({
      where: { id: userId },
      select: { role: { select: { code: true } } },
    }),
  ]);
  if (!user) throw new ApprovalError("User nahi mila", 404);

  const isDeliveryRole = user.role.code === "DELIVERY";
  const delivery =
    isDeliveryRole && canManageDelivery
      ? await db.deliveryDetail.findUnique({
          where: { orderId },
          select: { riderUserId: true, status: true },
        })
      : null;
  const isAssignedRider =
    order.orderType === "DELIVERY" &&
    delivery !== null &&
    isAssignedDeliveryRider(user.role.code, delivery.riderUserId, userId) &&
    (delivery.status === "PENDING" || delivery.status === "DISPATCHED");

  if (isDeliveryRole || !canRequestCancellation) {
    if (!isAssignedRider) {
      throw new ApprovalError("Cancel request karne ki ijazat nahi", 403);
    }
  }

  const isDeliveryRiderRequest = isDeliveryRole && isAssignedRider;
  const isAssignedDeliveryRequest =
    isDeliveryRiderRequest &&
    order.status === "SERVED" &&
    delivery?.status === "DISPATCHED";
  if (
    !CANCELLABLE_STATUSES.includes(order.status) &&
    !isAssignedDeliveryRequest
  ) {
    throw new ApprovalError(`${order.status} order cancel nahi ho sakta`, 409);
  }

  let reason: string;
  if (input.reasonCode === "OTHER") {
    const customReason = input.customReason?.trim();
    if (!customReason || customReason.length < 3) {
      throw new ApprovalError("Other ke liye custom wajah zaroori hai", 400);
    }
    reason = `Other: ${customReason}`;
  } else {
    reason = CANCELLATION_REASON_LABELS[input.reasonCode];
  }

  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
        if (isDeliveryRiderRequest) {
          await tx.$queryRaw`SELECT "id" FROM "DeliveryDetail" WHERE "orderId" = ${orderId} FOR UPDATE`;
        }
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });
        let deliveryStageAllowed = false;
        if (currentOrder?.status === "SERVED" && isDeliveryRiderRequest) {
          const currentDelivery = await tx.deliveryDetail.findUnique({
            where: { orderId },
            select: { riderUserId: true, status: true },
          });
          deliveryStageAllowed =
            currentDelivery?.status === "DISPATCHED" &&
            currentDelivery.riderUserId === userId;
        }
        if (
          !currentOrder ||
          (!CANCELLABLE_STATUSES.includes(currentOrder.status) &&
            !deliveryStageAllowed)
        ) {
          throw new ApprovalError(
            `${currentOrder?.status ?? "Order"} order cancel nahi ho sakta`,
            409
          );
        }

        const pending = await tx.approval.findFirst({
          where: {
            type: "ORDER_CANCEL",
            entityType: "Order",
            entityId: orderId,
            status: "PENDING",
          },
          select: { id: true },
        });
        if (pending) {
          throw new ApprovalError(
            "Is order ki cancel request pehle se pending hai",
            409
          );
        }

        const approval = await tx.approval.create({
          data: {
            type: "ORDER_CANCEL",
            entityType: "Order",
            entityId: orderId,
            reason,
            reasonCode: input.reasonCode,
            requestedById: userId,
          },
        });

        await writeAudit(tx, {
          actorId: userId,
          action: "ORDER_CANCEL_REQUESTED",
          entityType: "Order",
          entityId: orderId,
          before: { status: currentOrder.status },
          after: { approvalId: approval.id, reasonCode: input.reasonCode },
          reason,
        });

        await enqueueEvent(tx, "approval.requested", {
          approvalId: approval.id,
          orderId,
          branchId: order.branchId,
          requestedById: userId,
          reasonCode: input.reasonCode,
          reason,
        });

        return approval;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      throw new ApprovalError(
        "Cancel request abhi update hui hai. Refresh karke dobara try karein.",
        409
      );
    }
    throw error;
  }
}

/** Pending approvals jo is user ki branches ke hain */
export async function listPendingApprovals(userId: string) {
  if (!(await userHasPermission(userId, "orders.cancel.approve"))) {
    throw new ApprovalError("Approvals dekhne ki ijazat nahi", 403);
  }

  const approvals = await db.approval.findMany({
    where: {
      type: "ORDER_CANCEL",
      status: "PENDING",
      entityType: "Order",
      requestedById: { not: userId },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      requestedBy: { select: { fullName: true, role: { select: { name: true } } } },
    },
  });

  const result = [];
  for (const approval of approvals) {
    const order = await db.order.findUnique({
      where: { id: approval.entityId },
      select: {
        branchId: true,
        orderNumber: true,
        status: true,
        totalPaisa: true,
        customerName: true,
      },
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
  if (approval.type !== "ORDER_CANCEL" || approval.entityType !== "Order") {
    throw new ApprovalError("Ye order cancellation approval nahi hai", 422);
  }

  if (approval.status !== "PENDING") {
    throw new ApprovalError("Ye request pehle se decide ho chuki hai", 409);
  }

  if (approval.requestedById === userId) {
    throw new ApprovalError("Apni request khud approve nahi kar sakte", 403);
  }

  const order = await db.order.findUnique({
    where: { id: approval.entityId },
    select: { id: true, branchId: true, orderType: true },
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
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      if (order.orderType === "DELIVERY") {
        await tx.$queryRaw`SELECT "id" FROM "DeliveryDetail" WHERE "orderId" = ${order.id} FOR UPDATE`;
      }

      const current = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { status: true },
      });

      let deliveryStageAllowed = false;
      if (order.orderType === "DELIVERY") {
        const [requester, delivery] = await Promise.all([
          tx.user.findUnique({
            where: { id: approval.requestedById },
            select: { id: true, role: { select: { code: true } } },
          }),
          tx.deliveryDetail.findUnique({
            where: { orderId: order.id },
            select: { riderUserId: true, status: true },
          }),
        ]);
        if (delivery?.status === "DELIVERED" || delivery?.status === "FAILED") {
          throw new ApprovalError(
            "Completed delivery ka order cancel nahi ho sakta",
            409
          );
        }
        deliveryStageAllowed =
          current.status === "SERVED" &&
          delivery !== null &&
          delivery.status === "DISPATCHED" &&
          requester !== null &&
          isAssignedDeliveryRider(
            requester.role.code,
            delivery.riderUserId,
            requester.id
          );
      }

      if (
        !CANCELLABLE_STATUSES.includes(current.status) &&
        !deliveryStageAllowed
      ) {
        throw new ApprovalError(
          `${current.status} order ab cancel nahi ho sakta`,
          409
        );
      }

      if (current.status !== "CONFIRMED") {
        await createWastageForOrder(tx, order.id, userId, approval.reason);
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
