-- AlterTable
ALTER TABLE "User" ADD COLUMN "timezone" TEXT,
ADD COLUMN "calendarColor" TEXT;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN "color" TEXT;

-- AlterTable
ALTER TABLE "CalendarEventShare" ADD COLUMN "allowRsvp" BOOLEAN NOT NULL DEFAULT true;
