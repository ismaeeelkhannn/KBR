-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DISPATCHED', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerName" VARCHAR(100),
    "phone" VARCHAR(20),
    "category" VARCHAR(60) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" VARCHAR(500),
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintEvent" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "fromStatus" "ComplaintStatus",
    "toStatus" "ComplaintStatus" NOT NULL,
    "note" VARCHAR(500) NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDetail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "riderName" VARCHAR(100),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_branchId_status_idx" ON "Complaint"("branchId", "status");

-- CreateIndex
CREATE INDEX "ComplaintEvent_complaintId_idx" ON "ComplaintEvent"("complaintId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDetail_orderId_key" ON "DeliveryDetail"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryDetail_branchId_status_idx" ON "DeliveryDetail"("branchId", "status");

-- AddForeignKey
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
