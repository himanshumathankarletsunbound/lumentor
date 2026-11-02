CREATE TYPE "InitiativePlanType" AS ENUM ('INITIATIVE', 'FIXED_PAYOUT');

CREATE TABLE "InitiativePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planType" "InitiativePlanType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payoutFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InitiativePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InitiativeEntry" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "planId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "payoutFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "appliedPayrollBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InitiativeEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InitiativePlan_code_key" ON "InitiativePlan"("code");
CREATE INDEX "InitiativeEntry_mentorId_periodStart_periodEnd_idx" ON "InitiativeEntry"("mentorId", "periodStart", "periodEnd");
ALTER TABLE "InitiativePlan" ADD CONSTRAINT "InitiativePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeEntry" ADD CONSTRAINT "InitiativeEntry_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InitiativeEntry" ADD CONSTRAINT "InitiativeEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InitiativePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
