import type { OrderStatus } from "@prisma/client";

/**
 * Status transitions ka single source of truth.
 * CANCELLED yahan se nahi hota. Cancel sirf approval workflow se hota hai
 * (modules/approvals/approval.service.ts).
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PREPARING"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  PAID: [],
  CANCELLED: [],
};

/** Kitchen screen par dikhne wale status */
export const ACTIVE_KITCHEN_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];

/** Ye status wale orders cancel request ke liye eligible hain */
export const CANCELLABLE_STATUSES: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];
