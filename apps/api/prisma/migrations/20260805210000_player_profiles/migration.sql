ALTER TABLE "users"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "avatar" TEXT NOT NULL DEFAULT 'explorer',
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
