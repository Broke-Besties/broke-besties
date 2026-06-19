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

-- Realtime: broadcast row changes so the bell + toasts update live without refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";

-- RLS: each user sees only their own notifications. This also gates Realtime
-- delivery (Realtime evaluates the subscriber's SELECT policy), so the browser
-- only receives rows for the logged-in user. Writes/marks happen via Prisma on
-- the direct `postgres` connection, which bypasses RLS.
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON "Notification" TO authenticated;
CREATE POLICY "Users read own notifications"
  ON "Notification"
  FOR SELECT
  TO authenticated
  USING ("userId" = (select auth.uid())::text);
