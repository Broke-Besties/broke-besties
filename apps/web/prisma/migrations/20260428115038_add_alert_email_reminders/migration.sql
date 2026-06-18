-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderFrequencyDays" INTEGER;

-- CreateIndex
CREATE INDEX "Alert_reminderFrequencyDays_idx" ON "Alert"("reminderFrequencyDays");
