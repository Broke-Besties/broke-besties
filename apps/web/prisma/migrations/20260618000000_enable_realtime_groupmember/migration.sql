-- Broadcast GroupMember row changes over Supabase Realtime so the
-- groups list can live-refresh when membership changes (e.g. a new group).
-- supabase_realtime publication is created by Supabase on `supabase start`.
ALTER PUBLICATION supabase_realtime ADD TABLE "GroupMember";
