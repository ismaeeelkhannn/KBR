import { z } from "zod";

const complaintStatuses = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
] as const;

export const complaintStatusFilterSchema = z.enum(complaintStatuses);

export const complaintSchema = z.object({
  branchId: z.string().min(1),
  orderId: z.string().min(1).optional(),
  customerName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(5).max(1000),
});

export const complaintStatusSchema = z.object({
  to: z.enum(["IN_REVIEW", "RESOLVED", "REJECTED"]),
  note: z.string().trim().min(3).max(500),
});

export const deliverySchema = z.object({
  branchId: z.string().min(1),
  orderId: z.string().min(1),
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().min(5).max(300),
  riderUserId: z.string().min(1).optional(),
});

export const deliveryStatusSchema = z.object({
  to: z.enum(["DISPATCHED", "DELIVERED", "FAILED"]),
  riderUserId: z.string().min(1).optional(),
});
