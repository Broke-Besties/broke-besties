# Notification system — 2026-06-19 (branch: feature/notifications-system)

## Goal
Full notification system: email (Resend) on inter-user events + Instagram-style
realtime in-app pop-ups (no refresh), multi-user.

## What existed already
- ~20 Resend email templates + `email.service.ts` (try/catch internally → safe
  without an API key; just logs/returns {success:false}).
- sonner `<Toaster/>` mounted in layout.
- A realtime pattern in `groups-client.tsx` (postgres_changes on GroupMember).
- The header "notifications" were NOT real — recomputed each request from
  alerts + pending transactions; no persistence, no read state, no push.

## What was built
1. **`Notification` model** + migration `20260619000000_add_notifications`.
2. **`notification.service.ts`** — create/list/unreadCount/markRead/markAllRead.
   `create()` never throws into the caller (a failed notification can't break
   the underlying action).
3. **Notifications created at existing email hook points** in debt, debt-
   transaction, friend, invite services (recipient = the other app user).
   Skipped: tabs (no second app user), alert-reminder cron (email-only daily).
4. **Realtime UI** — `notifications-wrapper` (server) loads persisted list +
   unread count; `notifications-dropdown` (client) subscribes and shows the bell
   badge, list, mark-read on click + navigate, mark-all-read. Server actions in
   `app/notifications/actions.ts`.

## Realtime: the hard part (and the key decision)
- **postgres_changes does NOT work here.** Its WALRUS RLS engine fails on
  Prisma's PascalCase `"Notification"` table — realtime container logs:
  `relation "Notification" does not exist` in `realtime.apply_rls`. With RLS off
  it delivers but broadcasts everyone's rows to every client (privacy leak).
- **Solution: Realtime Broadcast over private per-user topics.**
  - DB trigger `broadcast_notification()` calls `realtime.send(payload,'INSERT',
    'notifications:'||userId, true)` on each insert.
  - RLS policy on `realtime.messages` authorizes a user to receive only their
    own topic (`realtime.topic() = 'notifications:'||auth.uid()`).
  - Client subscribes to `channel('notifications:<id>', {config:{private:true}})`
    after `realtime.setAuth(token)` and listens for `broadcast` `INSERT`.
  - Table keeps own-rows RLS (defense-in-depth for any PostgREST reads; app
    reads via Prisma which bypasses RLS).

## Verified (local, two principals)
- Standalone authenticated client received the broadcast instantly.
- Browser (logged in as bob): fired a notification from CLI (as if from Alice) →
  live sonner toast pop-up bottom-right + bell unread badge incremented, **no
  refresh**. Console showed `[notif-rt] broadcast {event:INSERT,...}`.
- RLS isolation: a user only receives their own topic.
- Migration re-applies cleanly from scratch (prod path). `prisma migrate status`
  = up to date. `tsc --noEmit` clean.
- Note: emails can't be sent without `RESEND_API_KEY` (expected); the service
  no-ops safely, notifications still fire.

## Follow-ups / open
- [ ] **Regression to fix:** the earlier `groupmember_rls` migration (already on
  main) enabled RLS on GroupMember, which breaks `groups-client.tsx`'s
  postgres_changes live-refresh via the SAME WALRUS PascalCase bug. Groups list
  no longer live-updates on membership change. Fix = convert it to the same
  Broadcast pattern (or accept stale-until-refresh). Flagged, not done (out of
  scope for this branch).
- [ ] Not yet pushed/PR'd. Prod deploy will run the migration via CI.
- [ ] Consider an in-app notification for alert reminders (currently email-only).
- [ ] `mark all read` / dropdown list verified by code + badge; Radix portal was
  finicky to screenshot but uses the same component as before.
