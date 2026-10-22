ALTER TABLE "User"
  ADD COLUMN "resetToken" TEXT,
  ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
