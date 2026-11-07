ALTER TABLE "ClasscardEvent"
  ADD COLUMN "gibbonCourseClassId" TEXT;

-- Preserve the source identifier for events fetched before this column existed.
UPDATE "ClasscardEvent"
SET "gibbonCourseClassId" = NULLIF(
  COALESCE(
    "rawPayload" ->> 'gibbonCourseClassID',
    "rawPayload" ->> 'gibbonCourseClassId'
  ),
  ''
)
WHERE "gibbonCourseClassId" IS NULL;

CREATE INDEX "ClasscardEvent_gibbonCourseClassId_startTime_idx"
  ON "ClasscardEvent"("gibbonCourseClassId", "startTime");

CREATE TYPE "ClasscardClassMappingStatus" AS ENUM ('MAPPED', 'UNMAPPED', 'NEEDS_REVIEW');

CREATE TABLE "ClasscardClassMapping" (
  "id" TEXT NOT NULL,
  "gibbonCourseClassId" TEXT NOT NULL,
  "displayTitle" TEXT,
  "payrollPlanId" TEXT,
  "status" "ClasscardClassMappingStatus" NOT NULL DEFAULT 'UNMAPPED',
  "mappedById" TEXT,
  "mappedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClasscardClassMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClasscardClassMapping_gibbonCourseClassId_key"
  ON "ClasscardClassMapping"("gibbonCourseClassId");
CREATE INDEX "ClasscardClassMapping_payrollPlanId_idx"
  ON "ClasscardClassMapping"("payrollPlanId");
CREATE INDEX "ClasscardClassMapping_status_idx"
  ON "ClasscardClassMapping"("status");

ALTER TABLE "ClasscardClassMapping"
  ADD CONSTRAINT "ClasscardClassMapping_payrollPlanId_fkey"
  FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClasscardClassMapping"
  ADD CONSTRAINT "ClasscardClassMapping_mappedById_fkey"
  FOREIGN KEY ("mappedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
