ALTER TABLE "Subject"
  ADD COLUMN "payrollPlanId" TEXT;

CREATE INDEX "Subject_payrollPlanId_idx" ON "Subject"("payrollPlanId");

ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_payrollPlanId_fkey"
  FOREIGN KEY ("payrollPlanId") REFERENCES "PayrollPlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
