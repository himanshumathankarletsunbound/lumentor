CREATE SEQUENCE IF NOT EXISTS "mentor_id_seq";

WITH numbered AS (
  SELECT
    "id" AS old_id,
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS sequence_number
  FROM "Mentor"
)
UPDATE "Mentor" AS mentor
SET "id" = 'LU-MEM-' || EXTRACT(YEAR FROM CURRENT_DATE)::int::text || '-' || numbered.sequence_number::text
FROM numbered
WHERE mentor."id" = numbered.old_id;

SELECT setval(
  '"mentor_id_seq"',
  COALESCE((SELECT COUNT(*) FROM "Mentor"), 1),
  true
);
