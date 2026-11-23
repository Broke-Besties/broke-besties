import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase";
import { calendarService } from "@/services/calendar.service";
import { groupService } from "@/services/group.service";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "./date-utils";
import { CalendarPageClient } from "./calendar-client";

export default async function CalendarPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const from = startOfWeek(startOfMonth(now));
  const to = endOfWeek(endOfMonth(now));

  const [events, groups, subscriptions] = await Promise.all([
    calendarService.listCalendar(user.id, { from, to }),
    groupService.getUserGroups(user.id),
    calendarService.listSubscriptions(user.id),
  ]);

  return (
    <CalendarPageClient
      initialMonth={now.toISOString()}
      initialEvents={events}
      groups={groups.map((group) => ({
        id: group.id,
        name: group.name,
        memberCount: group._count.members,
      }))}
      initialSubscriptions={subscriptions}
    />
  );
}
