-- Mission attendance status, pay type / daily rate, advances and deductions.
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'MISSION';

CREATE TYPE "PayType" AS ENUM ('MONTHLY', 'DAILY');
CREATE TYPE "AdjustmentKind" AS ENUM ('ADVANCE', 'DEDUCTION');

ALTER TABLE "Employee" ADD COLUMN "payType" "PayType" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN "dailyRate" DECIMAL(10,2);

ALTER TABLE "Payroll" ADD COLUMN "advanceDeductions" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "Advance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "kind" "AdjustmentKind" NOT NULL DEFAULT 'ADVANCE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Advance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Advance_employeeId_date_idx" ON "Advance"("employeeId", "date");
ALTER TABLE "Advance" ADD CONSTRAINT "Advance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
