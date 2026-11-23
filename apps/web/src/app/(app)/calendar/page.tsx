import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "./date-utils";
import { CalendarPageClient } from "./calendar-client";

export default async function CalendarPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const from = startOfWeek(startOfMonth(now));
  const to = endOfWeek(endOfMonth(now));

  const [events, groups, subscriptions, settings] = await Promise.all([
    calendarService.listCalendar(user.id, { from, to }),
    calendarService.listGroupOptions(user.id),
    calendarService.listSubscriptions(user.id),
    calendarService.getSettings(user.id),
  ]);

  return (
    <CalendarPageClient
      initialMonth={now.toISOString()}
      initialEvents={events}
      groups={groups}
      initialSubscriptions={subscriptions}
      initialTimezone={settings.timezone}
      initialPersonalColor={settings.personalColor}
    />
  );
}
