import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import { writeAudit } from "@/modules/audit/audit";
import { enqueueEvent } from "@/modules/outbox/outbox";
import type { PayInput } from "./payment.schemas";

export class PaymentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
  }
}

/**
 * Order ki payment.
 * - Sirf SERVED order, poori rakam, aur wahi cashier jisne shift kholi.
 * - Order status SERVED → PAID, history aur audit ke saath, ek transaction mein.
 * - Same idempotencyKey par pehli payment wapas aati hai (replayed = true).
 */
export async function recordPayment(
  userId: string,
  orderId: string,
  input: PayInput
) {
  if (!(await userHasPermission(userId, "cash.manage"))) {
    throw new PaymentError("Payment lene ki ijazat nahi", 403);
  }

  const existing = await db.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (existing.createdById !== userId || existing.orderId !== orderId) {
      throw new PaymentError(
        "Ye idempotency key kisi aur request ke liye use ho chuki hai",
        409
      );
    }
    return { payment: existing, replayed: true };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, branchId: true, status: true, totalPaisa: true },
  });
  if (!order) throw new PaymentError("Order nahi mila", 404);

  if (!(await userCanAccessBranch(userId, order.branchId))) {
    throw new PaymentError("Is branch ka access aap ke paas nahi", 403);
  }
  if (order.status !== "SERVED") {
    throw new PaymentError(
      `Payment sirf SERVED order par ho sakti hai (abhi: ${order.status})`,
      409
    );
  }
  if (input.amountPaisa !== order.totalPaisa) {
    throw new PaymentError(
      "Partial payment abhi allowed nahi. Poori rakam dein",
      422
    );
  }

  try {
    return await db.$transaction(async (tx) => {
      const [shift] = await tx.$queryRaw<
        {
          id: string;
          branchId: string;
          status: "OPEN" | "CLOSED";
          openedById: string;
        }[]
      >`
        SELECT "id", "branchId", "status", "openedById"
        FROM "CashShift"
        WHERE "id" = ${input.cashShiftId}
        FOR UPDATE
      `;

      if (!shift || shift.status !== "OPEN") {
        throw new PaymentError("Cash shift open nahi hai", 409);
      }
      if (shift.branchId !== order.branchId) {
        throw new PaymentError("Ye shift is order ki branch ki nahi", 422);
      }
      if (shift.openedById !== userId) {
        throw new PaymentError(
          "Sirf wahi cashier payment le sakta hai jisne shift kholi",
          403
        );
      }

      const moved = await tx.order.updateMany({
        where: { id: order.id, status: "SERVED" },
        data: { status: "PAID" },
      });
      if (moved.count === 0) {
        const replay = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (
          replay &&
          replay.createdById === userId &&
          replay.orderId === order.id
        ) {
          return { payment: replay, replayed: true };
        }
        throw new PaymentError(
          "Order ka status badal gaya. Refresh karein.",
          409
        );
      }

      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: "SERVED",
          toStatus: "PAID",
          changedById: userId,
          reason: `Payment: ${input.method}`,
        },
      });

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          cashShiftId: shift.id,
          method: input.method,
          amountPaisa: input.amountPaisa,
          reference: input.reference ?? null,
          idempotencyKey: input.idempotencyKey,
          createdById: userId,
        },
      });

      await writeAudit(tx, {
        actorId: userId,
        action: "PAYMENT_RECORDED",
        entityType: "Order",
        entityId: order.id,
        before: { status: "SERVED" },
        after: {
          status: "PAID",
          paymentId: payment.id,
          amountPaisa: input.amountPaisa,
          method: input.method,
        },
      });

      await enqueueEvent(tx, "payment.recorded", {
        orderId: order.id,
        paymentId: payment.id,
        amountPaisa: input.amountPaisa,
      });

      return { payment, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const [again, paidOrder] = await Promise.all([
        db.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        }),
        db.payment.findUnique({ where: { orderId } }),
      ]);
      if (again) {
        if (again.createdById === userId && again.orderId === orderId) {
          return { payment: again, replayed: true };
        }
        throw new PaymentError(
          "Ye idempotency key kisi aur request ke liye use ho chuki hai",
          409
        );
      }
      if (paidOrder) {
        throw new PaymentError("Ye order pehle se paid hai", 409);
      }
    }
    throw error;
  }
}
