CREATE TYPE "CancellationReasonCode" AS ENUM (
    'CUSTOMER_CHANGED_MIND',
    'WRONG_ORDER',
    'CUSTOMER_NOT_RESPONDING',
    'PAYMENT_ISSUE',
    'DELIVERY_PROBLEM',
    'PREPARATION_DELAY',
    'OUT_OF_STOCK',
    'OTHER'
);

ALTER TABLE "Approval"
ADD COLUMN "reasonCode" "CancellationReasonCode";

ALTER TABLE "Order"
ADD COLUMN "customerName" VARCHAR(100);

CREATE INDEX "OrderStatusEvent_toStatus_createdAt_idx"
ON "OrderStatusEvent"("toStatus", "createdAt");

CREATE INDEX "Approval_type_status_decidedAt_idx"
ON "Approval"("type", "status", "decidedAt");

CREATE INDEX "Approval_requestedById_decidedAt_idx"
ON "Approval"("requestedById", "decidedAt");
