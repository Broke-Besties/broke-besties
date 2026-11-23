"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CalendarSubscriptionView } from "./types";

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptions: CalendarSubscriptionView[];
  onImported: () => void;
  onSubscriptionsChanged: (subscriptions: CalendarSubscriptionView[]) => void;
};

type ImportResult = {
  source: string;
  imported: number;
  updated: number;
  removed: number;
  skipped: number;
};

function resultLabel(result: ImportResult): string {
  const parts = [
    result.imported > 0 ? `${result.imported} new` : null,
    result.updated > 0 ? `${result.updated} updated` : null,
    result.removed > 0 ? `${result.removed} removed` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Already up to date";
}

export function ImportDialog({
  open,
  onOpenChange,
  subscriptions,
  onImported,
  onSubscriptionsChanged,
}: ImportDialogProps) {
  const [items, setItems] = useState(subscriptions);
  const [fileBusy, setFileBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [syncId, setSyncId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setItems(subscriptions);
  }, [open, subscriptions]);

  async function importFile(file: File) {
    setFileBusy(true);
    try {
      const icsText = await file.text();
      const res = await fetch("/api/calendar/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ icsText, source: "ics" }),
      });
      const payload = (await res.json()) as {
        result?: ImportResult;
        error?: string;
      };
      if (!res.ok || !payload.result) {
        throw new Error(payload.error ?? "Could not import that calendar");
      }
      toast.success(`Imported: ${resultLabel(payload.result)}`);
      onImported();
      if (fileInput.current) fileInput.current.value = "";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not import that calendar",
      );
    } finally {
      setFileBusy(false);
    }
  }

  async function addSubscription(e: React.FormEvent) {
    e.preventDefault();
    setLinkBusy(true);
    try {
      const res = await fetch("/api/calendar/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      const payload = (await res.json()) as {
        subscription?: CalendarSubscriptionView;
        sync?: ImportResult | null;
        syncError?: string | null;
        error?: string;
      };
      if (!res.ok || !payload.subscription) {
        throw new Error(payload.error ?? "Could not add that calendar");
      }

      const next = [
        payload.subscription,
        ...items.filter((item) => item.id !== payload.subscription?.id),
      ];
      setItems(next);
      onSubscriptionsChanged(next);
      setName("");
      setUrl("");

      if (payload.syncError) {
        toast.error(`Calendar saved, but sync failed: ${payload.syncError}`);
      } else {
        toast.success(
          payload.sync
            ? `Subscribed: ${resultLabel(payload.sync)}`
            : "Calendar saved",
        );
      }
      onImported();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add that calendar",
      );
    } finally {
      setLinkBusy(false);
    }
  }

  async function syncSubscription(id: number) {
    setSyncId(id);
    try {
      const res = await fetch(`/api/calendar/subscriptions/${id}/sync`, {
        method: "POST",
      });
      const payload = (await res.json()) as {
        result?: ImportResult;
        error?: string;
      };
      if (!res.ok || !payload.result) {
        throw new Error(payload.error ?? "Could not sync that calendar");
      }
      toast.success(`Synced: ${resultLabel(payload.result)}`);
      const next = items.map((item) =>
        item.id === id
          ? { ...item, lastSyncedAt: new Date().toISOString(), lastError: null }
          : item,
      );
      setItems(next);
      onSubscriptionsChanged(next);
      onImported();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sync that calendar",
      );
    } finally {
      setSyncId(null);
    }
  }

  async function removeSubscription(id: number) {
    setSyncId(id);
    try {
      const res = await fetch(`/api/calendar/subscriptions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not remove that calendar");
      }
      const next = items.filter((item) => item.id !== id);
      setItems(next);
      onSubscriptionsChanged(next);
      toast.success("Calendar removed");
      onImported();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove that calendar",
      );
    } finally {
      setSyncId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a calendar</DialogTitle>
          <DialogDescription>
            Bring events over from Google Calendar or Apple Calendar. Upload an
            exported .ics file, or subscribe to a private calendar URL to keep
            it in sync.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upload">
              <Upload className="size-4" />
              Upload file
            </TabsTrigger>
            <TabsTrigger value="subscribe">
              <Link2 className="size-4" />
              Subscribe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3">
            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Choose an .ics file</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Google Calendar: Settings → Import &amp; export → Export. Apple
                Calendar: File → Export → Calendar Archive.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept=".ics,text/calendar"
                className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
                disabled={fileBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                }}
              />
            </div>
            {fileBusy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Reading calendar…
              </p>
            )}
          </TabsContent>

          <TabsContent value="subscribe" className="space-y-5">
            <form onSubmit={addSubscription} className="space-y-3">
              <Field>
                <FieldLabel htmlFor="calendar-name">Calendar name</FieldLabel>
                <Input
                  id="calendar-name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Google Calendar"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="calendar-url">Private ICS URL</FieldLabel>
                <Input
                  id="calendar-url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                />
                <FieldDescription>
                  Google Calendar: Settings → your calendar → Secret address in
                  iCal format. Apple Calendar: Share Calendar → Public Calendar
                  → copy link.
                </FieldDescription>
              </Field>
              <Button type="submit" disabled={linkBusy}>
                {linkBusy && <Loader2 className="size-4 animate-spin" />}
                Add and sync
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-sm font-medium">Subscribed calendars</p>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No subscriptions yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.lastError
                            ? item.lastError
                            : item.lastSyncedAt
                              ? `Synced ${new Date(item.lastSyncedAt).toLocaleString()}`
                              : "Not synced yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.lastError && (
                          <Badge variant="destructive">Error</Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Sync calendar"
                          onClick={() => syncSubscription(item.id)}
                          disabled={syncId === item.id}
                        >
                          {syncId === item.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove calendar"
                          onClick={() => removeSubscription(item.id)}
                          disabled={syncId === item.id}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
