"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Palette,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { ColorSettingsDialog } from "./color-settings-dialog";
import {
  addMonths,
  allDayKey,
  browserTimeZone,
  dayKey,
  eachDay,
  endOfMonth,
  endOfWeek,
  formatEventRange,
  formatTime,
  isSameDay,
  monthLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  zonedDayRange,
} from "./date-utils";
import { EventDetailDialog } from "./event-detail-dialog";
import { EventFormDialog } from "./event-form-dialog";
import { ImportDialog } from "./import-dialog";
import type {
  CalendarEventView,
  CalendarGroup,
  CalendarSubscriptionView,
} from "./types";

type CalendarPageClientProps = {
  initialMonth: string;
  initialEvents: CalendarEventView[];
  groups: CalendarGroup[];
  initialSubscriptions: CalendarSubscriptionView[];
  initialTimezone: string | null;
  initialPersonalColor: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function timezoneOptions(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    const supported = intl.supportedValuesOf?.("timeZone");
    return supported?.length ? supported : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

function eventsOnDay(
  events: CalendarEventView[],
  day: Date,
  timeZone: string,
) {
  const key = dayKey(day);
  const range = zonedDayRange(key, timeZone);
  return events
    .filter((event) => {
      if (event.allDay) {
        return (
          key >= allDayKey(event.startsAt) && key < allDayKey(event.endsAt)
        );
      }
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      return start < range.end && end > range.start;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function tint(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

function EventChip({
  event,
  timeZone,
  onClick,
}: {
  event: CalendarEventView;
  timeZone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4 hover:opacity-80",
        event.visibility === "busy" && "text-muted-foreground",
      )}
      style={{
        borderColor: tint(event.color, "66"),
        backgroundColor: tint(event.color, "1a"),
      }}
      title={event.title}
    >
      {event.visibility === "busy" && <Lock className="size-2.5 shrink-0" />}
      {!event.allDay && (
        <span className="shrink-0 font-medium">
          {formatTime(event.startsAt, timeZone)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

export function CalendarPageClient({
  initialMonth,
  initialEvents,
  groups,
  initialSubscriptions,
  initialTimezone,
  initialPersonalColor,
}: CalendarPageClientProps) {
  const [month, setMonth] = useState(() => new Date(initialMonth));
  const [events, setEvents] = useState(initialEvents);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<CalendarEventView | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [groupOptions, setGroupOptions] = useState(groups);
  const [personalColor, setPersonalColor] = useState(initialPersonalColor);
  const [timezone, setTimezone] = useState(initialTimezone ?? "UTC");
  const [showPersonal, setShowPersonal] = useState(true);
  const [activeGroups, setActiveGroups] = useState<Set<number>>(
    () => new Set(groups.map((group) => group.id)),
  );
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);
  const zones = useMemo(timezoneOptions, []);

  useEffect(() => {
    if (!initialTimezone) {
      setTimezone(browserTimeZone());
    }
  }, [initialTimezone]);

  const fetchMonth = useCallback(async (target: Date) => {
    const from = startOfWeek(startOfMonth(target));
    const to = endOfWeek(endOfMonth(target));
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        scope: "all",
      });
      const res = await fetch(`/api/calendar/events?${params.toString()}`);
      const payload = (await res.json()) as {
        events?: CalendarEventView[];
        error?: string;
      };
      if (!res.ok || !payload.events) {
        throw new Error(payload.error ?? "Could not load calendar");
      }
      setEvents(payload.events);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load calendar",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    void fetchMonth(month);
  }, [month, fetchMonth]);

  const refresh = useCallback(() => {
    void fetchMonth(month);
  }, [fetchMonth, month]);

  async function changeTimezone(next: string) {
    const previous = timezone;
    setTimezone(next);
    try {
      const res = await fetch("/api/calendar/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone: next }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not save timezone");
      }
      toast.success(`Times now shown in ${next.replace(/_/g, " ")}`);
    } catch (error) {
      setTimezone(previous);
      toast.error(
        error instanceof Error ? error.message : "Could not save timezone",
      );
    }
  }

  function toggleGroup(groupId: number) {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const filteredEvents = events.filter((event) => {
    if (event.isOwner) return showPersonal;
    return event.shares.some((share) => activeGroups.has(share.groupId));
  });

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDay(gridStart, gridEnd);
  const dayEvents = eventsOnDay(filteredEvents, selectedDay, timezone);
  const today = new Date();

  function openEvent(event: CalendarEventView) {
    setSelectedEvent(event);
    setDetailOpen(true);
  }

  function openCreate(day?: Date) {
    setEditingEvent(null);
    if (day) setSelectedDay(day);
    setFormOpen(true);
  }

  function openEdit(event: CalendarEventView) {
    setEditingEvent(event);
    setFormOpen(true);
  }

  function handleSaved(event: CalendarEventView) {
    setEvents((prev) => {
      const existing = prev.some((item) => item.id === event.id);
      return existing
        ? prev.map((item) => (item.id === event.id ? event : item))
        : [...prev, event];
    });
    refresh();
  }

  function handleChanged(event: CalendarEventView) {
    setSelectedEvent(event);
    setEvents((prev) =>
      prev.map((item) => (item.id === event.id ? event : item)),
    );
  }

  function handleDeleted(eventId: string) {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));
    setSelectedEvent(null);
    refresh();
  }

  function handleColorsSaved(
    nextGroups: CalendarGroup[],
    nextPersonalColor: string,
  ) {
    setGroupOptions(nextGroups);
    setPersonalColor(nextPersonalColor);
    setActiveGroups(
      (prev) =>
        new Set(nextGroups.map((group) => group.id).filter((id) => prev.has(id))),
    );
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Plan events, RSVP, and choose which groups see your schedule."
        actions={
          <>
            <Button variant="outline" onClick={() => setColorOpen(true)}>
              <Palette />
              Colors
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import
            </Button>
            <Button onClick={() => openCreate(selectedDay)}>
              <Plus />
              New event
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPersonal((value) => !value)}
          aria-pressed={showPersonal}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            showPersonal
              ? "bg-background"
              : "bg-muted text-muted-foreground opacity-60",
          )}
          style={{ borderColor: tint(personalColor, "88") }}
        >
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: personalColor }}
          />
          Personal
        </button>

        {groupOptions.map((group) => {
          const active = activeGroups.has(group.id);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-background"
                  : "bg-muted text-muted-foreground opacity-60",
              )}
              style={{ borderColor: tint(group.color, "88") }}
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              {group.name}
            </button>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowPersonal(true);
            setActiveGroups(new Set(groupOptions.map((group) => group.id)));
          }}
        >
          Show all
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Previous month"
                onClick={() => setMonth((current) => addMonths(current, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Next month"
                onClick={() => setMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <h2 className="ml-1 text-lg font-semibold">
                {monthLabel(month)}
              </h2>
              {loading && <Spinner className="ml-1 size-4" />}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  setMonth(now);
                  setSelectedDay(startOfDay(now));
                }}
              >
                Today
              </Button>
              <Select value={timezone} onValueChange={changeTimezone}>
                <SelectTrigger
                  className="w-[190px]"
                  aria-label="Calendar timezone"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {zones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                  {!zones.includes(timezone) && (
                    <SelectItem value={timezone}>
                      {timezone.replace(/_/g, " ")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDay);
              const dayItems = eventsOnDay(filteredEvents, day, timezone);
              return (
                <button
                  key={dayKey(day)}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  onDoubleClick={() => openCreate(day)}
                  className={cn(
                    "min-h-[108px] border-b border-r p-1.5 text-left align-top transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    isSelected && "bg-accent/60",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{dayItems.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((event) => (
                      <EventChip
                        key={`${event.id}-${dayKey(day)}`}
                        event={event}
                        timeZone={timezone}
                        onClick={() => openEvent(event)}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {selectedDay.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dayEvents.length}{" "}
                  {dayEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                aria-label="Add event on this day"
                onClick={() => openCreate(selectedDay)}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {dayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <CalendarDays className="mx-auto mb-2 size-5" />
                  Nothing planned.
                </div>
              ) : (
                dayEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => openEvent(event)}
                    className="block w-full rounded-lg border p-3 text-left transition hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 truncate text-sm font-medium">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: event.color }}
                        />
                        <span className="truncate">{event.title}</span>
                      </p>
                      {event.visibility === "busy" ? (
                        <Badge variant="outline">
                          <Lock className="size-3" />
                          Busy
                        </Badge>
                      ) : event.isOwner ? (
                        <Badge variant="secondary">Yours</Badge>
                      ) : (
                        <Badge variant="outline">Shared</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEventRange(
                        event.startsAt,
                        event.endsAt,
                        event.allDay,
                        timezone,
                      )}
                    </p>
                    {!event.isOwner && event.visibility === "details" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.owner.name}
                        {event.rsvp && event.rsvp !== "pending"
                          ? ` · you said ${event.rsvp}`
                          : ""}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Visibility</p>
            <p>
              Events are private until you share them. Use details + RSVP for
              invitations, details · view only to share without inviting
              anyone, or busy only to block the time without revealing the
              plan.
            </p>
          </div>
        </aside>
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        groups={groupOptions}
        timezone={timezone}
        event={editingEvent}
        initialDay={selectedDay}
        onSaved={handleSaved}
      />

      <EventDetailDialog
        event={selectedEvent}
        open={detailOpen}
        timezone={timezone}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        subscriptions={subscriptions}
        onImported={refresh}
        onSubscriptionsChanged={setSubscriptions}
      />

      <ColorSettingsDialog
        open={colorOpen}
        onOpenChange={setColorOpen}
        groups={groupOptions}
        personalColor={personalColor}
        onSaved={handleColorsSaved}
      />
    </div>
  );
}
