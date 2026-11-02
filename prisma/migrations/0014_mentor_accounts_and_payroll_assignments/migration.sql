ALTER TABLE "Mentor" ADD COLUMN "panNumber" TEXT;

CREATE TABLE "MentorPayrollPlan" (
  "id" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "payrollPlanId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MentorPayrollPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MentorPayrollPlan_mentorId_payrollPlanId_key"
  ON "MentorPayrollPlan"("mentorId", "payrollPlanId");
CREATE INDEX "MentorPayrollPlan_mentorId_isActive_idx"
  ON "MentorPayrollPlan"("mentorId", "isActive");

ALTER TABLE "MentorPayrollPlan"
  ADD CONSTRAINT "MentorPayrollPlan_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorPayrollPlan"
  ADD CONSTRAINT "MentorPayrollPlan_payrollPlanId_fkey"
  FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MentorPayrollPlan" ("id", "mentorId", "payrollPlanId", "updatedAt")
SELECT gen_random_uuid()::text, "id", "payrollPlanId", CURRENT_TIMESTAMP
FROM "Mentor";
