-- The previous migration (grant_realtime_select) granted SELECT on GroupMember
-- to `authenticated` with RLS off, exposing every membership row over
-- PostgREST/Realtime. Enable RLS and scope reads to the requesting user.
--
-- Prisma's server-side queries use the direct `postgres` connection and bypass
-- RLS, so this only constrains the browser realtime/PostgREST path. User.id is
-- the Supabase auth uid stored as text, so compare against auth.uid()::text.
-- The (select auth.uid()) wrapper lets Postgres cache it per-statement.
ALTER TABLE "GroupMember" ENABLE ROW LEVEL SECURITY;

-- ponytail: own-rows only — covers "I was added to / removed from a group".
-- Seeing co-members join a group you're already in would need a group-scoped
-- policy via a SECURITY DEFINER helper (self-referential RLS on GroupMember
-- recurses otherwise). Add that only if the live co-member case is needed.
CREATE POLICY "Members read own membership rows"
  ON "GroupMember"
  FOR SELECT
  TO authenticated
  USING ("userId" = (select auth.uid())::text);
