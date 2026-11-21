ALTER TABLE "ClasscardEvent" ADD COLUMN IF NOT EXISTS "classcardTitle" TEXT;
ALTER TABLE "ClasscardEvent" ADD COLUMN IF NOT EXISTS "titleKey" TEXT;

CREATE INDEX IF NOT EXISTS "ClasscardEvent_titleKey_idx" ON "ClasscardEvent"("titleKey");

CREATE TABLE IF NOT EXISTS "ClasscardTitleMapping" (
  "id" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "displayTitle" TEXT NOT NULL,
  "payrollPlanId" TEXT,
  "status" "ClasscardClassMappingStatus" NOT NULL DEFAULT 'UNMAPPED',
  "mappedById" TEXT,
  "mappedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClasscardTitleMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClasscardTitleMapping_normalizedTitle_key" ON "ClasscardTitleMapping"("normalizedTitle");
CREATE INDEX IF NOT EXISTS "ClasscardTitleMapping_payrollPlanId_idx" ON "ClasscardTitleMapping"("payrollPlanId");
CREATE INDEX IF NOT EXISTS "ClasscardTitleMapping_status_idx" ON "ClasscardTitleMapping"("status");

DO $$ BEGIN
  ALTER TABLE "ClasscardTitleMapping"
    ADD CONSTRAINT "ClasscardTitleMapping_payrollPlanId_fkey"
    FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClasscardTitleMapping"
    ADD CONSTRAINT "ClasscardTitleMapping_mappedById_fkey"
    FOREIGN KEY ("mappedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
