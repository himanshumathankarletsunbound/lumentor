CREATE TABLE "AttendanceSummary" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "studentId" TEXT,
    "subjectId" TEXT,
    "studentName" TEXT,
    "studentExternalId" TEXT,
    "subjectName" TEXT,
    "className" TEXT,
    "attendanceDate" TIMESTAMP(3),
    "timeRange" TEXT,
    "location" TEXT,
    "staffName" TEXT,
    "enrolled" INTEGER NOT NULL DEFAULT 0,
    "present" INTEGER NOT NULL DEFAULT 0,
    "absent" INTEGER NOT NULL DEFAULT 0,
    "attendancePercentage" DOUBLE PRECISION,
    "sourceFile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendanceSummary_sourceKey_key" ON "AttendanceSummary"("sourceKey");
CREATE INDEX "AttendanceSummary_reportType_idx" ON "AttendanceSummary"("reportType");
CREATE INDEX "AttendanceSummary_attendanceDate_idx" ON "AttendanceSummary"("attendanceDate");
CREATE INDEX "AttendanceSummary_studentId_idx" ON "AttendanceSummary"("studentId");
CREATE INDEX "AttendanceSummary_subjectId_idx" ON "AttendanceSummary"("subjectId");

ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
