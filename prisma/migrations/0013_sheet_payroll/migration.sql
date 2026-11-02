CREATE TYPE "SheetPayrollBatchStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'LOCKED');

CREATE TABLE "SheetPayrollBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "periodName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "status" "SheetPayrollBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "totalMentors" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SheetPayrollBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SheetPayrollLineItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "absentCount" INTEGER NOT NULL DEFAULT 0,
    "absentBillableCount" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "grossEarnings" DECIMAL(12,2) NOT NULL,
    "deductions" DECIMAL(12,2) NOT NULL,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerRemark" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "SheetPayrollLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SheetPayrollBatch_batchNumber_key" ON "SheetPayrollBatch"("batchNumber");
CREATE INDEX "SheetPayrollLineItem_batchId_idx" ON "SheetPayrollLineItem"("batchId");
CREATE INDEX "SheetPayrollLineItem_mentorId_idx" ON "SheetPayrollLineItem"("mentorId");

ALTER TABLE "SheetPayrollLineItem"
  ADD CONSTRAINT "SheetPayrollLineItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "SheetPayrollBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SheetPayrollLineItem"
  ADD CONSTRAINT "SheetPayrollLineItem_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
