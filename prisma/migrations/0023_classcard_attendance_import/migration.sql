CREATE TABLE "ClasscardAttendanceImport" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FETCHED',
    "rawPayload" JSONB NOT NULL,
    "eventPayload" JSONB,
    "csvText" TEXT,
    "fetchedRows" INTEGER NOT NULL DEFAULT 0,
    "mappedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClasscardAttendanceImport_pkey" PRIMARY KEY ("id")
);
