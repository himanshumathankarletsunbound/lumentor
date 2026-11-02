ALTER TABLE "PayrollLineItem" DROP CONSTRAINT IF EXISTS "PayrollLineItem_payrollPlanId_fkey";
ALTER TABLE "PayrollLineItem" ALTER COLUMN "payrollPlanId" DROP NOT NULL;
ALTER TABLE "PayrollLineItem"
  ADD CONSTRAINT "PayrollLineItem_payrollPlanId_fkey"
  FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
