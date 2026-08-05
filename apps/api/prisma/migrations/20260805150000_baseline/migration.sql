-- Baseline del esquema que ya existia en las branches de Neon.
-- Esta migracion se marca como aplicada al incorporarla; no se ejecuta sobre
-- las bases existentes. En instalaciones nuevas crea el esquema completo.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentWorld" INTEGER NOT NULL DEFAULT 1,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "lives" INTEGER NOT NULL DEFAULT 3,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "unlocked" TEXT[] DEFAULT ARRAY['1-1']::TEXT[],
    "levelStats" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "world" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "nonce" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "valid" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "runId" TEXT,
    "world" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "enemiesDefeated" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "level_catalog" (
    "id" TEXT NOT NULL,
    "world" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "boss" TEXT,
    CONSTRAINT "level_catalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_tip_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "taunt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_tip_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
CREATE UNIQUE INDEX "progress_userId_key" ON "progress"("userId");
CREATE INDEX "runs_userId_startedAt_idx" ON "runs"("userId", "startedAt");
CREATE UNIQUE INDEX "scores_runId_key" ON "scores"("runId");
CREATE INDEX "scores_world_level_score_idx" ON "scores"("world", "level", "score" DESC);
CREATE INDEX "scores_score_idx" ON "scores"("score" DESC);
CREATE INDEX "scores_createdAt_idx" ON "scores"("createdAt");
CREATE UNIQUE INDEX "level_catalog_world_level_key" ON "level_catalog"("world", "level");
CREATE UNIQUE INDEX "ai_tip_cache_cacheKey_key" ON "ai_tip_cache"("cacheKey");
CREATE INDEX "ai_tip_cache_createdAt_idx" ON "ai_tip_cache"("createdAt");

ALTER TABLE "progress" ADD CONSTRAINT "progress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "runs" ADD CONSTRAINT "runs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scores" ADD CONSTRAINT "scores_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scores" ADD CONSTRAINT "scores_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
