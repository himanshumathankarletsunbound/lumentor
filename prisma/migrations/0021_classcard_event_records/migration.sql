CREATE TABLE "ClasscardEvent" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "mentorId" TEXT,
  "classEventId" TEXT,
  "classcardStaffId" TEXT NOT NULL,
  "subjectName" TEXT,
  "subjectExternalId" TEXT,
  "locationName" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "attendanceStatus" TEXT,
  "rawPayload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClasscardEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClasscardEvent_externalId_key" ON "ClasscardEvent"("externalId");
CREATE INDEX "ClasscardEvent_mentorId_startTime_idx" ON "ClasscardEvent"("mentorId", "startTime");
CREATE INDEX "ClasscardEvent_classcardStaffId_startTime_idx" ON "ClasscardEvent"("classcardStaffId", "startTime");
ALTER TABLE "ClasscardEvent" ADD CONSTRAINT "ClasscardEvent_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClasscardEvent" ADD CONSTRAINT "ClasscardEvent_classEventId_fkey" FOREIGN KEY ("classEventId") REFERENCES "ClassEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
