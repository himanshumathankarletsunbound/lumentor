DELETE FROM "MentorPayrollPlan";

ALTER TABLE "Mentor" DROP CONSTRAINT IF EXISTS "Mentor_payrollPlanId_fkey";
ALTER TABLE "Mentor" ALTER COLUMN "payrollPlanId" DROP NOT NULL;
ALTER TABLE "Mentor"
  ADD CONSTRAINT "Mentor_payrollPlanId_fkey"
  FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Mentor" SET "payrollPlanId" = NULL;
