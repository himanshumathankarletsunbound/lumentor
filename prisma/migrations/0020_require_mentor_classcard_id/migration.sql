-- Existing mentors created before Classcard IDs were required receive an explicit
-- legacy marker. These rows must be reconciled with their real Classcard staff ID.
UPDATE "Mentor"
SET "externalId" = 'LEGACY-' || "id"
WHERE "externalId" IS NULL OR btrim("externalId") = '';

ALTER TABLE "Mentor"
ALTER COLUMN "externalId" SET NOT NULL;
