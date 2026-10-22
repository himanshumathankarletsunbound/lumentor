ALTER TABLE "User"
  ADD COLUMN "salt" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "roleName" TEXT,
  ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "sessionToken" TEXT,
  ADD COLUMN "sessionExpiry" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_sessionToken_key" ON "User"("sessionToken");
