"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allDayKey,
  defaultEventTimes,
  fromDateInput,
  fromDateTimeLocal,
  shiftAllDayKey,
  toDateTimeLocal,
} from "./date-utils";
import type {
  CalendarEventView,
  CalendarGroup,
  CalendarVisibility,
  ShareSelection,
} from "./types";

type EventFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CalendarGroup[];
  event?: CalendarEventView | null;
  initialDay?: Date;
  onSaved: (event: CalendarEventView) => void;
};

type FormState = {
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  busy: boolean;
  shares: ShareSelection;
};

function defaultShares(groups: CalendarGroup[]): ShareSelection {
  return groups.reduce<ShareSelection>((acc, group) => {
    acc[group.id] = "none";
    return acc;
  }, {});
}

function buildFormState(
  event: CalendarEventView | null | undefined,
  groups: CalendarGroup[],
  day?: Date,
): FormState {
  const shares = defaultShares(groups);
  if (event) {
    for (const share of event.shares) {
      shares[share.groupId] = share.visibility;
    }
  }

  if (event) {
    return {
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      allDay: event.allDay,
      start: event.allDay
        ? allDayKey(event.startsAt)
        : toDateTimeLocal(event.startsAt),
      // All-day ends are exclusive on the server, so show the last included day.
      end: event.allDay
        ? shiftAllDayKey(allDayKey(event.endsAt), -1)
        : toDateTimeLocal(event.endsAt),
      busy: event.busy,
      shares,
    };
  }

  const times = defaultEventTimes(day ?? new Date());
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    start: times.start,
    end: times.end,
    busy: true,
    shares,
  };
}

export function EventFormDialog({
  open,
  onOpenChange,
  groups,
  event,
  initialDay,
  onSaved,
}: EventFormDialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    buildFormState(event, groups, initialDay),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildFormState(event, groups, initialDay));
    }
  }, [open, event, groups, initialDay]);

  const editing = !!event;
  const shareCount = useMemo(
    () =>
      Object.values(form.shares).filter((visibility) => visibility !== "none")
        .length,
    [form.shares],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const startsAt = form.allDay
        ? fromDateInput(form.start)
        : fromDateTimeLocal(form.start);
      const endsAt = form.allDay
        ? fromDateInput(form.end, true)
        : fromDateTimeLocal(form.end);

      const shares = Object.entries(form.shares)
        .filter(([, visibility]) => visibility !== "none")
        .map(([groupId, visibility]) => ({
          groupId: Number(groupId),
          visibility: visibility as CalendarVisibility,
        }));

      const response = await fetch(
        editing
          ? `/api/calendar/events/${event.id}`
          : "/api/calendar/events",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            location: form.location || null,
            startsAt,
            endsAt,
            allDay: form.allDay,
            busy: form.busy,
            shares,
          }),
        },
      );

      const payload = (await response.json()) as {
        event?: CalendarEventView;
        error?: string;
      };
      if (!response.ok || !payload.event) {
        throw new Error(payload.error ?? "Could not save event");
      }

      toast.success(editing ? "Event updated" : "Event created");
      onSaved(payload.event);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5" />
            {editing ? "Edit event" : "New event"}
          </DialogTitle>
          <DialogDescription>
            Plan something on your calendar. Choose which groups can see the
            details, or show them as busy only.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field>
            <FieldLabel htmlFor="event-title">Title</FieldLabel>
            <Input
              id="event-title"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Dinner at Mara's"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;
                  setForm((prev) => ({
                    ...prev,
                    allDay,
                    start: allDay
                      ? prev.start.slice(0, 10)
                      : `${prev.start.slice(0, 10)}T18:00`,
                    end: allDay
                      ? prev.end.slice(0, 10)
                      : `${prev.end.slice(0, 10)}T19:00`,
                  }));
                }}
              />
              All day
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.busy}
                onChange={(e) => update("busy", e.target.checked)}
              />
              Show as busy
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="event-start">
                {form.allDay ? "Start date" : "Starts"}
              </FieldLabel>
              <Input
                id="event-start"
                type={form.allDay ? "date" : "datetime-local"}
                required
                value={form.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="event-end">
                {form.allDay ? "End date" : "Ends"}
              </FieldLabel>
              <Input
                id="event-end"
                type={form.allDay ? "date" : "datetime-local"}
                required
                value={form.end}
                onChange={(e) => update("end", e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="event-location">Location</FieldLabel>
            <Input
              id="event-location"
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="event-description">Notes</FieldLabel>
            <Textarea
              id="event-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Optional details for the people you share with"
            />
          </Field>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Who can see this?</p>
              <FieldDescription>
                Nothing is shared until you pick a group. Busy hides the title
                and location but blocks the time.
              </FieldDescription>
            </div>

            {groups.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                You are not in any groups yet. Create one to share calendar
                events.
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.memberCount}{" "}
                        {group.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                    <Select
                      value={form.shares[group.id] ?? "none"}
                      onValueChange={(value) =>
                        update("shares", {
                          ...form.shares,
                          [group.id]: value as CalendarVisibility | "none",
                        })
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not shared</SelectItem>
                        <SelectItem value="details">Full details</SelectItem>
                        <SelectItem value="busy">Busy only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {shareCount > 0 && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="size-3.5" />
                    Shared with {shareCount}{" "}
                    {shareCount === 1 ? "group" : "groups"}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
