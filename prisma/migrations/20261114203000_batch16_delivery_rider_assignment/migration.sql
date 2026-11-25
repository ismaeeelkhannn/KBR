ALTER TABLE "DeliveryDetail"
ADD COLUMN "riderUserId" TEXT;

ALTER TABLE "DeliveryDetail"
ADD CONSTRAINT "DeliveryDetail_riderUserId_fkey"
FOREIGN KEY ("riderUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "DeliveryDetail_riderUserId_status_idx"
ON "DeliveryDetail"("riderUserId", "status");
