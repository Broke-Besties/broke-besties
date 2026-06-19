-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on the table: each user sees only their own notifications. The app reads
-- via Prisma (direct postgres connection, bypasses RLS); this scopes any
-- PostgREST access. Note: postgres_changes is NOT used for live delivery — its
-- WALRUS RLS engine fails on Prisma's PascalCase "Notification" table. Instead
-- we use Realtime Broadcast (below).
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON "Notification" TO authenticated;
CREATE POLICY "Users read own notifications"
  ON "Notification"
  FOR SELECT
  TO authenticated
  USING ("userId" = (select auth.uid())::text);

-- Live delivery via Realtime Broadcast on a private per-user topic.
-- A trigger broadcasts each new notification to "notifications:<userId>".
CREATE OR REPLACE FUNCTION public.broadcast_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'type', NEW.type,
      'title', NEW.title,
      'body', NEW.body,
      'link', NEW.link,
      'createdAt', NEW."createdAt"
    ),
    'INSERT',
    'notifications:' || NEW."userId",
    true -- private topic
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notification_broadcast ON "Notification";
CREATE TRIGGER notification_broadcast
  AFTER INSERT ON "Notification"
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_notification();

-- Authorize each user to receive broadcasts only on their own topic. Realtime
-- evaluates this SELECT policy on realtime.messages when a client joins a
-- private channel and when delivering broadcasts.
DROP POLICY IF EXISTS "Receive own notification broadcasts" ON realtime.messages;
CREATE POLICY "Receive own notification broadcasts"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() = 'notifications:' || (select auth.uid())::text
  );
