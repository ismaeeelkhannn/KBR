import { z } from "zod";

export const CANCELLATION_REASON_LABELS = {
  CUSTOMER_CHANGED_MIND: "Customer changed mind",
  WRONG_ORDER: "Wrong order placed",
  CUSTOMER_NOT_RESPONDING: "Customer not responding",
  PAYMENT_ISSUE: "Payment issue",
  DELIVERY_PROBLEM: "Delivery problem",
  PREPARATION_DELAY: "Food preparation delay",
  OUT_OF_STOCK: "Out of stock",
  OTHER: "Other",
} as const;

export const cancelRequestSchema = z
  .object({
    reasonCode: z.enum([
      "CUSTOMER_CHANGED_MIND",
      "WRONG_ORDER",
      "CUSTOMER_NOT_RESPONDING",
      "PAYMENT_ISSUE",
      "DELIVERY_PROBLEM",
      "PREPARATION_DELAY",
      "OUT_OF_STOCK",
      "OTHER",
    ]),
    customReason: z.string().trim().max(193).optional(),
  })
  .superRefine((value, context) => {
    if (value.reasonCode === "OTHER") {
      if (!value.customReason || value.customReason.length < 3) {
        context.addIssue({
          code: "custom",
          path: ["customReason"],
          message: "Other ke liye wajah kam az kam 3 characters ki honi chahiye",
        });
      }
    } else if (value.customReason !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["customReason"],
        message: "Custom wajah sirf Other ke liye di ja sakti hai",
      });
    }
  });

export const decideApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(200).optional(),
});
