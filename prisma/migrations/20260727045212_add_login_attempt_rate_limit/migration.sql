-- Table backing the login rate limiter (see lib/rate-limit.ts).
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginAttempt_ipHash_createdAt_idx" ON "LoginAttempt"("ipHash", "createdAt");

-- Lock this new table out of Supabase's public REST API, same as Phase 7.2 did
-- for the existing tables. Supabase auto-grants anon/authenticated full DML on
-- every new public-schema table, so without this the rate-limit log would be
-- world-readable/writable through PostgREST. The app reaches it only via Prisma
-- (which connects as the table owner and bypasses RLS).
REVOKE ALL PRIVILEGES ON TABLE "LoginAttempt" FROM anon, authenticated;
ALTER TABLE "LoginAttempt" ENABLE ROW LEVEL SECURITY;