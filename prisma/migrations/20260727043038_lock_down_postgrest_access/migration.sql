-- Lock Supabase's public REST API out of the application tables.
--
-- Supabase grants `anon` and `authenticated` full DML on every table created in
-- the public schema, and PostgREST exposes those roles over the internet using
-- the publishable key that ships inside the browser bundle. Before this
-- migration, `anon` held SELECT/INSERT/UPDATE/DELETE on "Item" with row level
-- security disabled and no policies, so any valid publishable key would have
-- granted the whole internet read and write access to the inventory.
--
-- This app never uses PostgREST. It reaches Postgres through Prisma and uses
-- Supabase only for Storage, which lives in a different schema and is untouched
-- by the statements below.
--
-- Two independent controls, deliberately:
--   1. REVOKE removes the privileges outright.
--   2. ENABLE ROW LEVEL SECURITY with no policies denies every row anyway, so a
--      future default-privilege grant cannot silently re-expose these tables.
--
-- Prisma is unaffected: it connects as `postgres`, which owns these tables, and
-- an owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set. It is not set.

REVOKE ALL PRIVILEGES ON TABLE "Item" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "_prisma_migrations" FROM anon, authenticated;

ALTER TABLE "Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;