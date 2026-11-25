-- CreateTable
CREATE TABLE "DailyClosing" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "businessDate" VARCHAR(10) NOT NULL,
    "salesPaisa" INTEGER NOT NULL,
    "expensesPaisa" INTEGER NOT NULL,
    "purchasesPaisa" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyClosing_branchId_businessDate_key" ON "DailyClosing"("branchId", "businessDate");
