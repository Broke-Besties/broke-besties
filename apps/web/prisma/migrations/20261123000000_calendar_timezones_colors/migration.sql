-- AlterTable
ALTER TABLE "User" ADD COLUMN "preferences" JSONB;

-- AlterTable
ALTER TABLE "CalendarEventShare" ADD COLUMN "allowRsvp" BOOLEAN NOT NULL DEFAULT true;
