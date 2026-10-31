ALTER TYPE "SystemRole" ADD VALUE IF NOT EXISTS 'AUDIT';

CREATE TABLE "MentorReview" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "reviewPeriod" TEXT NOT NULL,
    "auditScore" DECIMAL(4,2),
    "operationScore" DECIMAL(4,2),
    "totalScore" DECIMAL(4,2),
    "auditComments" TEXT,
    "operationComments" TEXT,
    "auditReviewerId" TEXT,
    "operationReviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MentorReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MentorReview_mentorId_reviewPeriod_key" ON "MentorReview"("mentorId", "reviewPeriod");
CREATE INDEX "MentorReview_reviewPeriod_idx" ON "MentorReview"("reviewPeriod");
CREATE INDEX "MentorReview_totalScore_idx" ON "MentorReview"("totalScore");
ALTER TABLE "MentorReview" ADD CONSTRAINT "MentorReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorReview" ADD CONSTRAINT "MentorReview_auditReviewerId_fkey" FOREIGN KEY ("auditReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MentorReview" ADD CONSTRAINT "MentorReview_operationReviewerId_fkey" FOREIGN KEY ("operationReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
