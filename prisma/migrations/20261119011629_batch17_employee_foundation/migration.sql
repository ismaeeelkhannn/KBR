-- Batch 17: additive employee foundation

ALTER TABLE "Employee"
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "assignedManagerId" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "cnic" TEXT,
  ADD COLUMN "profilePictureUrl" TEXT,
  ADD COLUMN "emergencyContact" TEXT,
  ADD COLUMN "emergencyPhone" TEXT;

CREATE TABLE "EmployeeDepartment" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeSalary" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "monthlySalaryPaisa" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeDepartment_code_key" ON "EmployeeDepartment"("code");
CREATE INDEX "EmployeeDepartment_isActive_idx" ON "EmployeeDepartment"("isActive");

CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX "Employee_assignedManagerId_idx" ON "Employee"("assignedManagerId");
CREATE INDEX "Employee_status_branchId_idx" ON "Employee"("status", "branchId");
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

CREATE UNIQUE INDEX "EmployeeSalary_employeeId_effectiveFrom_key"
  ON "EmployeeSalary"("employeeId", "effectiveFrom");
CREATE INDEX "EmployeeSalary_employeeId_effectiveFrom_idx"
  ON "EmployeeSalary"("employeeId", "effectiveFrom");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "EmployeeDepartment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_assignedManagerId_fkey"
  FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalary"
  ADD CONSTRAINT "EmployeeSalary_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalary"
  ADD CONSTRAINT "EmployeeSalary_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
