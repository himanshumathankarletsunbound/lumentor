ALTER TABLE "PayrollPlan" ADD COLUMN IF NOT EXISTS "formula" TEXT;

CREATE TABLE IF NOT EXISTS "PenaltyPolicy" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deductionType" TEXT NOT NULL DEFAULT 'FIXED_AMOUNT',
    "rateValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyPolicy_pkey" PRIMARY KEY ("id")
);
