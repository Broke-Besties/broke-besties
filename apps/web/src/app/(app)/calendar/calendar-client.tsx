"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import {
  addMonths,
  allDayKey,
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
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function eventsOnDay(events: CalendarEventView[], day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const key = dayKey(day);
  return events
    .filter((event) => {
      if (event.allDay) {
        return (
          key >= allDayKey(event.startsAt) && key < allDayKey(event.endsAt)
        );
      }
      const start = new Date(event.startsAt).getTime();
      const end = new Date(event.endsAt).getTime();
      return start < dayEnd && end > dayStart;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function eventClasses(event: CalendarEventView): string {
  if (event.visibility === "owner") {
    return "border-primary/30 bg-primary/10 text-primary";
  }
  if (event.visibility === "busy") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-border bg-accent text-accent-foreground";
}

function EventChip({
  event,
  onClick,
}: {
  event: CalendarEventView;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[11px] leading-4 hover:opacity-80",
        eventClasses(event),
      )}
      title={event.title}
    >
      {event.visibility === "busy" && <Lock className="size-2.5 shrink-0" />}
      {!event.allDay && (
        <span className="shrink-0 font-medium">{formatTime(event.startsAt)}</span>
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
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [loading, setLoading] = useState(false);
  const didMount = useRef(false);

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

  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDay(gridStart, gridEnd);
  const dayEvents = eventsOnDay(events, selectedDay);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Plan events, RSVP, and choose which groups see your schedule."
        actions={
          <>
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
              <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" />
                  Yours
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-accent-foreground/40" />
                  Shared
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="size-3" />
                  Busy
                </span>
              </div>
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
              const dayItems = eventsOnDay(events, day);
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
                      <p className="truncate text-sm font-medium">
                        {event.title}
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
              Events are private until you share them. Share full details for
              RSVPs, or busy only to block the time without revealing the plan.
            </p>
          </div>
        </aside>
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        groups={groups}
        event={editingEvent}
        initialDay={selectedDay}
        onSaved={handleSaved}
      />

      <EventDetailDialog
        event={selectedEvent}
        open={detailOpen}
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
    </div>
  );
}
