"use client";

import { useEffect, useState } from "react";
import { Loader2, Palette } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { CALENDAR_COLORS } from "@/lib/calendar-colors";
import type { CalendarGroup } from "./types";

type ColorSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CalendarGroup[];
  personalColor: string;
  onSaved: (groups: CalendarGroup[], personalColor: string) => void;
};

function Swatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CALENDAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color}`}
          aria-pressed={value.toLowerCase() === color}
          onClick={() => onChange(color)}
          className={cn(
            "size-6 rounded-full border-2 transition",
            value.toLowerCase() === color
              ? "border-foreground"
              : "border-transparent hover:scale-110",
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function ColorSettingsDialog({
  open,
  onOpenChange,
  groups,
  personalColor,
  onSaved,
}: ColorSettingsDialogProps) {
  const [personal, setPersonal] = useState(personalColor);
  const [groupColors, setGroupColors] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPersonal(personalColor);
      setGroupColors(
        groups.reduce<Record<number, string>>((acc, group) => {
          acc[group.id] = group.color;
          return acc;
        }, {}),
      );
    }
  }, [open, personalColor, groups]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/calendar/colors", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          personalColor: personal,
          groups: groups.map((group) => ({
            groupId: group.id,
            color: groupColors[group.id] ?? group.color,
          })),
        }),
      });
      const payload = (await res.json()) as {
        settings?: { personalColor: string };
        groups?: CalendarGroup[];
        error?: string;
      };
      if (!res.ok || !payload.settings || !payload.groups) {
        throw new Error(payload.error ?? "Could not save colors");
      }
      toast.success("Calendar colors updated");
      onSaved(payload.groups, payload.settings.personalColor);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save colors",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-5" />
            Calendar colors
          </DialogTitle>
          <DialogDescription>
            Pick a color for your own events and for each group. Group colors
            only affect your calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Personal events</p>
              <p className="text-xs text-muted-foreground">Your own plans</p>
            </div>
            <Swatches value={personal} onChange={setPersonal} />
          </div>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Join a group to give shared events their own color.
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <Swatches
                  value={groupColors[group.id] ?? group.color}
                  onChange={(color) =>
                    setGroupColors((prev) => ({
                      ...prev,
                      [group.id]: color,
                    }))
                  }
                />
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save colors
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
