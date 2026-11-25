import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userHasPermission,
  userCanAccessBranch,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { FinanceError } from "@/modules/finance/finance.service";
import type { z } from "zod";
import {
  complaintSchema,
  complaintStatusFilterSchema,
  deliverySchema,
} from "./operations.schemas";
import { isAssignedDeliveryRider } from "./delivery-access";

type ComplaintInput = z.infer<typeof complaintSchema>;
type DeliveryInput = z.infer<typeof deliverySchema>;
type ComplaintStatus = z.infer<typeof complaintStatusFilterSchema>;
type ComplaintStatusTarget = "IN_REVIEW" | "RESOLVED" | "REJECTED";
type DeliveryStatusTarget = "DISPATCHED" | "DELIVERED" | "FAILED";

const COMPLAINT_NEXT: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

const DELIVERY_NEXT: Record<
  "PENDING" | "DISPATCHED" | "DELIVERED" | "FAILED",
  ("PENDING" | "DISPATCHED" | "DELIVERED" | "FAILED")[]
> = {
  PENDING: ["DISPATCHED"],
  DISPATCHED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
};

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

export async function createComplaint(userId: string, input: ComplaintInput) {
  await assertAccess(userId, input.branchId, "complaints.manage");

  if (input.orderId) {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { branchId: true },
    });
    if (!order || order.branchId !== input.branchId) {
      throw new FinanceError(422, "Order is branch mein nahi mila");
    }
  }

  return db.$transaction(async (tx) => {
    const complaint = await tx.complaint.create({
      data: {
        ...input,
        orderId: input.orderId ?? null,
        status: "OPEN",
        createdById: userId,
      },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        fromStatus: null,
        toStatus: "OPEN",
        note: "Complaint darj hui",
        changedById: userId,
      },
    });
    await writeAudit(tx, {
      actorId: userId,
      action: "COMPLAINT_CREATED",
      entityType: "Complaint",
      entityId: complaint.id,
    });
    return complaint;
  });
}

export async function changeComplaintStatus(
  userId: string,
  complaintId: string,
  to: ComplaintStatusTarget,
  note: string
) {
  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
  });
  if (!complaint) {
    throw new FinanceError(404, "Complaint nahi mili");
  }
  await assertAccess(userId, complaint.branchId, "complaints.manage");

  if (!COMPLAINT_NEXT[complaint.status].includes(to)) {
    throw new FinanceError(
      409,
      `${complaint.status} se ${to} allowed nahi hai`
    );
  }

  const closing = to === "RESOLVED" || to === "REJECTED";
  return db.$transaction(async (tx) => {
    const result = await tx.complaint.updateMany({
      where: { id: complaintId, status: complaint.status },
      data: {
        status: to,
        ...(closing
          ? {
              resolution: note,
              resolvedById: userId,
              resolvedAt: new Date(),
            }
          : {}),
      },
    });
    if (result.count === 0) {
      throw new FinanceError(
        409,
        "Status abhi badal chuka hai, dobara try karein"
      );
    }

    await tx.complaintEvent.create({
      data: {
        complaintId,
        fromStatus: complaint.status,
        toStatus: to,
        note,
        changedById: userId,
      },
    });
    await writeAudit(tx, {
      actorId: userId,
      action: "COMPLAINT_STATUS_CHANGED",
      entityType: "Complaint",
      entityId: complaintId,
      before: { status: complaint.status },
      after: { status: to },
    });
    return tx.complaint.findUniqueOrThrow({ where: { id: complaintId } });
  });
}

export async function createDelivery(userId: string, input: DeliveryInput) {
  await assertAccess(userId, input.branchId, "delivery.manage");
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { role: { select: { code: true } } },
  });
  if (!creator) throw new FinanceError(404, "User nahi mila");
  if (creator.role.code === "DELIVERY") {
    throw new FinanceError(
      403,
      "Delivery Staff ko order manager assign karega"
    );
  }

  const rider = input.riderUserId
    ? await db.user.findUnique({
        where: { id: input.riderUserId },
        select: {
          fullName: true,
          isActive: true,
          deletedAt: true,
          role: { select: { code: true } },
        },
      })
    : null;
  if (
    input.riderUserId &&
    (!rider ||
      !rider.isActive ||
      rider.deletedAt ||
      rider.role.code !== "DELIVERY")
  ) {
    throw new FinanceError(422, "Active Delivery Staff select karein");
  }
  if (
    input.riderUserId &&
    !(await userCanAccessBranch(input.riderUserId, input.branchId))
  ) {
    throw new FinanceError(422, "Rider ko is branch ki access nahi hai");
  }

  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { branchId: true, orderType: true },
  });
  if (!order || order.branchId !== input.branchId) {
    throw new FinanceError(422, "Order is branch mein nahi mila");
  }
  if (order.orderType !== "DELIVERY") {
    throw new FinanceError(422, "Ye order DELIVERY type ka nahi hai");
  }

  const existing = await db.deliveryDetail.findUnique({
    where: { orderId: input.orderId },
  });
  if (existing) {
    throw new FinanceError(409, "Is order ki delivery pehle se bani hai");
  }

  try {
    return await db.$transaction(async (tx) => {
      const delivery = await tx.deliveryDetail.create({
        data: {
          ...input,
          riderName: rider?.fullName ?? null,
          status: "PENDING",
        },
      });
      await tx.order.update({
        where: { id: input.orderId },
        data: { customerName: input.customerName },
      });
      await writeAudit(tx, {
        actorId: userId,
        action: "DELIVERY_CREATED",
        entityType: "DeliveryDetail",
        entityId: delivery.id,
      });
      return delivery;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FinanceError(409, "Is order ki delivery pehle se bani hai");
    }
    throw error;
  }
}

export async function changeDeliveryStatus(
  userId: string,
  orderId: string,
  to: DeliveryStatusTarget,
  riderUserId?: string
) {
  const delivery = await db.deliveryDetail.findUnique({ where: { orderId } });
  if (!delivery) {
    throw new FinanceError(404, "Delivery nahi mili");
  }
  await assertAccess(userId, delivery.branchId, "delivery.manage");

  if (!DELIVERY_NEXT[delivery.status].includes(to)) {
    throw new FinanceError(
      409,
      `${delivery.status} se ${to} allowed nahi hai`
    );
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, role: { select: { code: true } } },
  });
  if (!actor) throw new FinanceError(404, "User nahi mila");
  if (
    actor.role.code === "DELIVERY" &&
    !isAssignedDeliveryRider(actor.role.code, delivery.riderUserId, userId)
  ) {
    throw new FinanceError(403, "Sirf assigned delivery hi update kar sakte hain");
  }
  if (
    actor.role.code === "DELIVERY" &&
    riderUserId !== undefined &&
    riderUserId !== userId
  ) {
    throw new FinanceError(403, "Delivery Staff apna assignment change nahi kar sakta");
  }
  if (riderUserId && to !== "DISPATCHED") {
    throw new FinanceError(422, "Rider sirf dispatch ke waqt assign ho sakta hai");
  }

  let assignedRider: {
    id: string;
    fullName: string;
    isActive: boolean;
    deletedAt: Date | null;
    role: { code: string };
  } | null = null;
  if (to === "DISPATCHED") {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order || (order.status !== "READY" && order.status !== "SERVED")) {
      throw new FinanceError(
        409,
        "Order ready ya served hone se pehle dispatch nahi ho sakta"
      );
    }

    const assignedRiderId =
      actor.role.code === "DELIVERY"
        ? userId
        : riderUserId ?? delivery.riderUserId;
    if (!assignedRiderId) {
      throw new FinanceError(422, "Dispatch se pehle Delivery Staff assign karein");
    }

    assignedRider = await db.user.findUnique({
      where: { id: assignedRiderId },
      select: {
        id: true,
        fullName: true,
        isActive: true,
        deletedAt: true,
        role: { select: { code: true } },
      },
    });
    if (
      !assignedRider ||
      !assignedRider.isActive ||
      assignedRider.deletedAt ||
      assignedRider.role.code !== "DELIVERY"
    ) {
      throw new FinanceError(422, "Active Delivery Staff select karein");
    }
    if (!(await userCanAccessBranch(assignedRiderId, delivery.branchId))) {
      throw new FinanceError(422, "Rider ko is branch ki access nahi hai");
    }
  }

  if (to === "DELIVERED" && !delivery.riderUserId) {
    throw new FinanceError(409, "Delivered karne se pehle rider assign hona chahiye");
  }

  const now = new Date();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
    const currentOrder = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!currentOrder || currentOrder.status === "CANCELLED") {
      throw new FinanceError(409, "Cancelled order ki delivery update nahi ho sakti");
    }
    if (
      to === "DISPATCHED" &&
      currentOrder.status !== "READY" &&
      currentOrder.status !== "SERVED"
    ) {
      throw new FinanceError(
        409,
        "Order ready ya served hone se pehle dispatch nahi ho sakta"
      );
    }

    const result = await tx.deliveryDetail.updateMany({
      where: { orderId, status: delivery.status },
      data: {
        status: to,
        ...(to === "DISPATCHED" && assignedRider
          ? {
              riderUserId: assignedRider.id,
              riderName: assignedRider.fullName,
            }
          : {}),
        ...(to === "DISPATCHED" ? { dispatchedAt: now } : {}),
        ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
      },
    });
    if (result.count === 0) {
      throw new FinanceError(
        409,
        "Status abhi badal chuka hai, dobara try karein"
      );
    }

    await writeAudit(tx, {
      actorId: userId,
      action: "DELIVERY_STATUS_CHANGED",
      entityType: "DeliveryDetail",
      entityId: delivery.id,
      before: { status: delivery.status },
      after: { status: to },
    });
    return tx.deliveryDetail.findUniqueOrThrow({ where: { orderId } });
  });
}
