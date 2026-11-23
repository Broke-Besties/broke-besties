"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatEventRange } from "./date-utils";
import type { CalendarEventView } from "./types";

type EventDetailDialogProps = {
  event: CalendarEventView | null;
  open: boolean;
  timezone: string;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: CalendarEventView) => void;
  onChanged: (event: CalendarEventView) => void;
  onDeleted: (eventId: string) => void;
};

const responseStyles: Record<string, string> = {
  yes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  no: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  pending: "bg-muted text-muted-foreground",
};

export function EventDetailDialog({
  event,
  open,
  timezone,
  onOpenChange,
  onEdit,
  onChanged,
  onDeleted,
}: EventDetailDialogProps) {
  const [working, setWorking] = useState<"rsvp" | "delete" | null>(null);

  if (!event) return null;

  async function respond(response: "yes" | "no") {
    if (!event) return;
    setWorking("rsvp");
    try {
      const res = await fetch(`/api/calendar/events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const payload = (await res.json()) as {
        event?: CalendarEventView;
        error?: string;
      };
      if (!res.ok || !payload.event) {
        throw new Error(payload.error ?? "Could not RSVP");
      }
      toast.success(response === "yes" ? "You're going" : "You declined");
      onChanged(payload.event);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not RSVP");
    } finally {
      setWorking(null);
    }
  }

  async function remove() {
    if (!event) return;
    if (!window.confirm("Delete this event for everyone?")) return;
    setWorking("delete");
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not delete event");
      }
      toast.success("Event deleted");
      onDeleted(event.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete event");
    } finally {
      setWorking(null);
    }
  }

  const invited = event.invitees ?? [];
  const yesCount = invited.filter((person) => person.response === "yes").length;
  const noCount = invited.filter((person) => person.response === "no").length;
  const pendingCount = invited.filter(
    (person) => person.response === "pending",
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            {event.isOwner ? (
              <Badge variant="secondary">Your event</Badge>
            ) : event.visibility === "busy" ? (
              <Badge variant="outline">
                <Lock className="size-3" />
                Busy
              </Badge>
            ) : (
              <Badge variant="outline">Shared with you</Badge>
            )}
            {event.source !== "app" && (
              <Badge variant="outline">Imported</Badge>
            )}
            {!event.busy && <Badge variant="outline">Free</Badge>}
          </div>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              {formatEventRange(
                event.startsAt,
                event.endsAt,
                event.allDay,
                timezone,
              )}
            </span>
            {event.location && (
              <span className="flex items-center gap-2">
                <MapPin className="size-4" />
                {event.location}
              </span>
            )}
            {!event.isOwner && (
              <span className="flex items-center gap-2">
                <Users className="size-4" />
                Hosted by {event.owner.name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {event.description && (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
            {event.description}
          </p>
        )}

        {!event.isOwner &&
          event.visibility === "details" &&
          !event.canRsvp && (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              This event was shared with you as view only, so RSVPs are closed.
            </div>
          )}

        {!event.isOwner &&
          event.visibility === "details" &&
          event.canRsvp && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Are you going?</p>
                <p className="text-xs text-muted-foreground">
                  {event.rsvp === "yes"
                    ? "You said yes."
                    : event.rsvp === "no"
                      ? "You declined."
                      : "You have not responded yet."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={event.rsvp === "yes" ? "default" : "outline"}
                  onClick={() => respond("yes")}
                  disabled={working !== null}
                >
                  {working === "rsvp" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Yes
                </Button>
                <Button
                  size="sm"
                  variant={event.rsvp === "no" ? "default" : "outline"}
                  onClick={() => respond("no")}
                  disabled={working !== null}
                >
                  <X className="size-4" />
                  No
                </Button>
              </div>
            </div>
          </div>
        )}

        {event.isOwner && (
          <>
            <Separator />
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Shared with</p>
                {event.shares.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Private. Only you can see this event.
                  </p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {event.shares.map((share) => (
                      <Badge
                        key={share.groupId}
                        variant="outline"
                        className="gap-1.5"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: share.color }}
                        />
                        {share.groupName} ·{" "}
                        {share.visibility === "busy"
                          ? "busy"
                          : share.allowRsvp
                            ? "RSVP"
                            : "view only"}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">
                  RSVPs{" "}
                  <span className="font-normal text-muted-foreground">
                    {yesCount} yes · {noCount} no · {pendingCount} waiting
                  </span>
                </p>
                {invited.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Share with a group to invite people and collect RSVPs.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {invited.map((person) => (
                      <li
                        key={person.userId}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="truncate">
                          {person.name}{" "}
                          <span className="text-muted-foreground">
                            {person.email}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${responseStyles[person.response] ?? responseStyles.pending}`}
                        >
                          {person.response}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}

        {event.isOwner && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(event);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={working !== null}
            >
              {working === "delete" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
