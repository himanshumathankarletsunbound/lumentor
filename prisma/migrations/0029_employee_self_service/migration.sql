ALTER TABLE "LeaveRequest" ADD COLUMN "reviewNotes" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "supportingDocumentUrl" TEXT;
CREATE TABLE "EmployeeAttendance" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "checkIn" TIMESTAMP(3), "checkOut" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'PRESENT', "missedReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeAttendance_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "EmployeeAttendance_employeeId_date_key" ON "EmployeeAttendance"("employeeId", "date");
ALTER TABLE "EmployeeAttendance" ADD CONSTRAINT "EmployeeAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TYPE "LeaveRequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
