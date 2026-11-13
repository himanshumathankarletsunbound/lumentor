ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeCode" TEXT;
UPDATE "Employee" SET "employeeCode" = 'LU-EMP-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD((100000 + FLOOR(RANDOM() * 900000))::TEXT, 6, '0') WHERE "employeeCode" IS NULL;
ALTER TABLE "Employee" ALTER COLUMN "employeeCode" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeCode_key" ON "Employee"("employeeCode");
