import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  userCanAccessBranch,
  userHasPermission,
} from "@/modules/access-control/permissions";
import type { CreateOrderInput } from "./order.schemas";

export class OrderError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OrderError";
    this.status = status;
  }
}

/** Order number: branch ke andar unique. Format: ORD-<time>-<random> */
function makeOrderNumber(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${Date.now().toString(36).toUpperCase()}-${random}`;
}

/**
 * Order banata hai.
 * - Idempotency: same key par wahi pehla order wapas aata hai (replayed = true).
 * - Price: har variant ka latest price server se uthaya jata hai, client ki price kabhi nahi lete.
 * - Total: subtotal aur total server par paisa mein calculate hota hai.
 */
export async function createOrder(userId: string, input: CreateOrderInput) {
  if (!(await userHasPermission(userId, "orders.create"))) {
    throw new OrderError("Is user ko order banane ki ijazat nahi", 403);
  }

  const branch = await db.branch.findUnique({ where: { id: input.branchId } });
  if (!branch || !branch.isActive || branch.deletedAt) {
    throw new OrderError("Branch mojood nahi ya band hai", 404);
  }
  if (!(await userCanAccessBranch(userId, branch.id))) {
    throw new OrderError("Is branch ka access aap ke paas nahi", 403);
  }

  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    if (existing.createdById !== userId) {
      throw new OrderError("Ye idempotency key kisi aur user ki hai", 409);
    }
    return { order: existing, replayed: true };
  }

  const now = new Date();
  const lines: {
    variantId: string;
    priceVersionId: string;
    productNameSnapshot: string;
    variantNameSnapshot: string;
    unitPricePaisa: number;
    quantity: number;
    lineTotalPaisa: number;
    note: string | null;
  }[] = [];

  for (const item of input.items) {
    const variant = await db.productVariant.findUnique({
      where: { id: item.variantId },
      include: { product: { include: { category: true } } },
    });

    if (
      !variant ||
      !variant.isActive ||
      variant.deletedAt ||
      !variant.product.isActive ||
      variant.product.deletedAt ||
      !variant.product.category.isActive ||
      variant.product.category.deletedAt
    ) {
      throw new OrderError(`Item available nahi: ${item.variantId}`, 422);
    }

    const price = await db.priceVersion.findFirst({
      where: { variantId: variant.id, effectiveFrom: { lte: now } },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!price) {
      throw new OrderError(`Price set nahi: ${variant.name}`, 422);
    }

    lines.push({
      variantId: variant.id,
      priceVersionId: price.id,
      productNameSnapshot: variant.product.name,
      variantNameSnapshot: variant.name,
      unitPricePaisa: price.amountPaisa,
      quantity: item.quantity,
      lineTotalPaisa: price.amountPaisa * item.quantity,
      note: item.note ?? null,
    });
  }

  const subtotalPaisa = lines.reduce((sum, line) => sum + line.lineTotalPaisa, 0);
  const discountPaisa = 0;
  const totalPaisa = subtotalPaisa - discountPaisa;

  try {
    const order = await db.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        branchId: branch.id,
        createdById: userId,
        orderType: input.orderType,
        idempotencyKey: input.idempotencyKey,
        subtotalPaisa,
        discountPaisa,
        totalPaisa,
        items: { create: lines },
      },
      include: { items: true },
    });
    return { order, replayed: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await findByIdempotencyKey(input.idempotencyKey);
      if (again && again.createdById === userId) {
        return { order: again, replayed: true };
      }
    }
    throw error;
  }
}

async function findByIdempotencyKey(key: string) {
  return db.order.findUnique({
    where: { idempotencyKey: key },
    include: { items: true },
  });
}
