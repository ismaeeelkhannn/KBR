import type { OrderStatus } from "@prisma/client";

/**
 * Status transitions ka single source of truth.
 * Jo transition yahan nahi, wo kisi bhi API se allowed nahi.
 * CANCELLED abhi sirf CONFIRMED se. PREPARING ke baad cancel ke liye
 * approval workflow chahiye (agle batch mein).
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["SERVED"],
  SERVED: [],
  PAID: [],
  CANCELLED: [],
};

/** Kitchen screen par dikhne wale status */
export const ACTIVE_KITCHEN_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "READY",
];
