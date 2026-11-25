-- CreateEnum
CREATE TYPE "StoreRequisitionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PARTIAL', 'REJECTED', 'ISSUED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StoreRequisition" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requisitionNo" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requesterEmployeeId" TEXT,
    "purpose" TEXT,
    "status" "StoreRequisitionStatus" NOT NULL DEFAULT 'REQUESTED',
    "totalPaisa" INTEGER NOT NULL DEFAULT 0,
    "requiresManagerApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "managerApprovedById" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRequisitionLine" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "approvedQty" INTEGER NOT NULL DEFAULT 0,
    "issuedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCostPaisa" INTEGER NOT NULL DEFAULT 0,
    "lineTotalPaisa" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "StoreRequisitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreIssueVoucher" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "totalPaisa" INTEGER NOT NULL,
    "issuedById" TEXT NOT NULL,
    "receivedById" TEXT NOT NULL,
    "verifyMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreIssueVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreStaffPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreStaffPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreRequisition_branchId_status_idx" ON "StoreRequisition"("branchId", "status");

-- CreateIndex
CREATE INDEX "StoreRequisition_requestedById_idx" ON "StoreRequisition"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "StoreRequisition_branchId_requisitionNo_key" ON "StoreRequisition"("branchId", "requisitionNo");

-- CreateIndex
CREATE INDEX "StoreRequisitionLine_requisitionId_idx" ON "StoreRequisitionLine"("requisitionId");

-- CreateIndex
CREATE INDEX "StoreRequisitionLine_inventoryItemId_idx" ON "StoreRequisitionLine"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreIssueVoucher_requisitionId_key" ON "StoreIssueVoucher"("requisitionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreIssueVoucher_branchId_voucherNo_key" ON "StoreIssueVoucher"("branchId", "voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "StoreStaffPin_userId_key" ON "StoreStaffPin"("userId");

-- AddForeignKey
ALTER TABLE "StoreRequisitionLine" ADD CONSTRAINT "StoreRequisitionLine_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "StoreRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreIssueVoucher" ADD CONSTRAINT "StoreIssueVoucher_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "StoreRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
