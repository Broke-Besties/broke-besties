import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";

import ical, { type VEvent } from "node-ical";

import { prisma } from "@/lib/prisma";
import { CalendarPolicy } from "@/policies";

export type CalendarVisibility = "details" | "busy";
export type RsvpResponse = "yes" | "no";

export type EventShareInput = {
  groupId: number;
  visibility: CalendarVisibility;
};

export type CreateEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | Date;
  endsAt: string | Date;
  allDay?: boolean;
  busy?: boolean;
  shares?: EventShareInput[];
};

export type UpdateEventInput = Partial<CreateEventInput>;

export type CalendarShareView = {
  groupId: number;
  groupName: string;
  visibility: CalendarVisibility;
};

export type CalendarEventView = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  busy: boolean;
  status: string;
  source: string;
  owner: { id: string; name: string; email: string };
  isOwner: boolean;
  visibility: "owner" | CalendarVisibility;
  rsvp: RsvpResponse | "pending" | null;
  shares: CalendarShareView[];
  rsvps?: Array<{
    userId: string;
    name: string;
    email: string;
    response: RsvpResponse | "pending";
  }>;
  invitees?: Array<{
    userId: string;
    name: string;
    email: string;
    response: RsvpResponse | "pending";
  }>;
  createdAt: string;
  updatedAt: string;
};

type Person = { id: string; name: string; email: string };

type EventShareRecord = {
  visibility: string;
  group: {
    id: number;
    name: string;
    members?: Array<{ user: Person }>;
  };
};

type EventRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  busy: boolean;
  status: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  owner: Person;
  shares: EventShareRecord[];
  rsvps: Array<{ response: string; user: Person }>;
};

export type CalendarSubscriptionView = {
  id: number;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportResult = {
  source: string;
  imported: number;
  updated: number;
  removed: number;
  skipped: number;
};

const personSelect = { id: true, name: true, email: true } as const;
const MAX_TITLE_LENGTH = 200;
const MAX_INSTANCES = 2000;
const RECURRENCE_PAST_DAYS = 30;
const RECURRENCE_FUTURE_DAYS = 365;

const ownerInclude = {
  owner: { select: personSelect },
  shares: {
    include: {
      group: {
        select: {
          id: true,
          name: true,
          members: { select: { user: { select: personSelect } } },
        },
      },
    },
  },
  rsvps: { include: { user: { select: personSelect } } },
} as const;

function sharedInclude(userId: string) {
  return {
    owner: { select: personSelect },
    shares: {
      where: { group: { members: { some: { userId } } } },
      include: { group: { select: { id: true, name: true } } },
    },
    rsvps: {
      where: { userId },
      include: { user: { select: personSelect } },
    },
  } as const;
}

function normalizeVisibility(value: string | undefined): CalendarVisibility {
  return value === "busy" ? "busy" : "details";
}

function strongestVisibility(shares: EventShareRecord[]): CalendarVisibility | null {
  if (shares.some((share) => share.visibility === "details")) return "details";
  if (shares.length > 0) return "busy";
  return null;
}

function parseDate(value: string | Date | undefined, field: string): Date {
  if (!value) throw new Error(`${field} is required`);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }
  return date;
}

function cleanText(value: string | null | undefined, max = 2000): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeTitle(value: string | undefined): string {
  const title = value?.trim();
  if (!title) throw new Error("Event title is required");
  return title.slice(0, MAX_TITLE_LENGTH);
}

function validateRange(
  startsAt: Date,
  endsAt: Date,
  allDay: boolean,
): { startsAt: Date; endsAt: Date } {
  if (endsAt.getTime() < startsAt.getTime()) {
    throw new Error("Event end must be after its start");
  }
  if (endsAt.getTime() === startsAt.getTime()) {
    if (!allDay) throw new Error("Event end must be after its start");
    return { startsAt, endsAt: new Date(startsAt.getTime() + 86_400_000) };
  }
  return { startsAt, endsAt };
}

function normalizeAllDayRange(startsAt: Date, endsAt: Date) {
  const start = new Date(
    Date.UTC(
      startsAt.getUTCFullYear(),
      startsAt.getUTCMonth(),
      startsAt.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      endsAt.getUTCFullYear(),
      endsAt.getUTCMonth(),
      endsAt.getUTCDate(),
    ),
  );
  return { startsAt: start, endsAt: end };
}

function rsvpFrom(event: EventRecord, userId: string): RsvpResponse | "pending" {
  const rsvp = event.rsvps.find((row) => row.user.id === userId);
  if (!rsvp) return "pending";
  return rsvp.response === "yes" ? "yes" : "no";
}

function sharesToView(shares: EventShareRecord[]): CalendarShareView[] {
  return shares.map((share) => ({
    groupId: share.group.id,
    groupName: share.group.name,
    visibility: normalizeVisibility(share.visibility),
  }));
}

function inviteesFrom(event: EventRecord): CalendarEventView["invitees"] {
  const detailGroupIds = new Set(
    event.shares
      .filter((share) => normalizeVisibility(share.visibility) === "details")
      .map((share) => share.group.id),
  );
  const responseByUser = new Map<string, RsvpResponse | "pending">(
    event.rsvps.map((rsvp) => [
      rsvp.user.id,
      rsvp.response === "yes" ? "yes" : rsvp.response === "no" ? "no" : "pending",
    ]),
  );
  const invitees = new Map<
    string,
    { userId: string; name: string; email: string; response: RsvpResponse | "pending" }
  >();

  for (const share of event.shares) {
    if (!detailGroupIds.has(share.group.id)) continue;
    for (const member of share.group.members ?? []) {
      if (member.user.id === event.ownerId) continue;
      invitees.set(member.user.id, {
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        response: responseByUser.get(member.user.id) ?? "pending",
      });
    }
  }

  return [...invitees.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toEventView(
  event: EventRecord,
  userId: string,
  visibility: "owner" | CalendarVisibility,
): CalendarEventView {
  const base = {
    id: event.id,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    allDay: event.allDay,
    busy: event.busy,
    status: event.status,
    source: event.source,
    owner: event.owner,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };

  if (visibility === "busy") {
    return {
      ...base,
      title: "Busy",
      description: null,
      location: null,
      isOwner: false,
      visibility: "busy",
      rsvp: null,
      shares: [],
    };
  }

  const view: CalendarEventView = {
    ...base,
    title: event.title,
    description: event.description,
    location: event.location,
    isOwner: visibility === "owner",
    visibility,
    rsvp: visibility === "owner" ? null : rsvpFrom(event, userId),
    shares: sharesToView(event.shares),
  };

  if (visibility === "owner") {
    view.invitees = inviteesFrom(event);
    view.rsvps = event.rsvps.map((rsvp) => ({
      userId: rsvp.user.id,
      name: rsvp.user.name,
      email: rsvp.user.email,
      response:
        rsvp.response === "yes" ? "yes" : rsvp.response === "no" ? "no" : "pending",
    }));
  } else {
    view.rsvps = event.rsvps.map((rsvp) => ({
      userId: rsvp.user.id,
      name: rsvp.user.name,
      email: rsvp.user.email,
      response:
        rsvp.response === "yes" ? "yes" : rsvp.response === "no" ? "no" : "pending",
    }));
  }

  return view;
}

function assertVisibility(value: string): CalendarVisibility {
  if (value !== "details" && value !== "busy") {
    throw new Error('Visibility must be "details" or "busy"');
  }
  return value;
}

function hashUid(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function normalizeSubscriptionUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Calendar URL is required");
  const withScheme = trimmed.replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Calendar URL is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Calendar URL must use http or https");
  }
  return url.toString();
}

function isPrivateAddress(address: string): boolean {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

async function assertSafeSubscriptionUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    throw new Error("Calendar URL must be publicly reachable");
  }

  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) {
    throw new Error("Calendar host could not be resolved");
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Calendar URL must be publicly reachable");
  }
}

type ParsedInstance = {
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  busy: boolean;
  status: string;
};

/**
 * All-day events are stored at UTC midnight so the calendar date is the same
 * no matter which timezone the browser or server is in.
 */
function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function allDayCount(start: Date, end: Date | null): number {
  if (!end) return 1;
  const days = Math.round(
    (utcMidnight(end).getTime() - utcMidnight(start).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  return Math.max(1, days);
}

function expandVEvent(vevent: VEvent): ParsedInstance[] {
  const start = vevent.start instanceof Date ? vevent.start : null;
  if (!start || Number.isNaN(start.getTime())) return [];

  const allDay = vevent.datetype === "date";
  const explicitEnd = vevent.end instanceof Date ? vevent.end : null;
  const durationDays = allDay ? allDayCount(start, explicitEnd) : 0;
  const durationMs =
    explicitEnd && explicitEnd.getTime() > start.getTime()
      ? explicitEnd.getTime() - start.getTime()
      : allDay
        ? 24 * 60 * 60 * 1000
        : 60 * 60 * 1000;

  const title = cleanText(vevent.summary, MAX_TITLE_LENGTH) ?? "Untitled event";
  const description = cleanText(vevent.description);
  const location = cleanText(vevent.location);
  const busy = vevent.transparency !== "TRANSPARENT";
  const status = vevent.status === "CANCELLED" ? "cancelled" : "confirmed";
  const uid =
    cleanText(vevent.uid, 200) ??
    hashUid(`${title}|${start.toISOString()}|${location ?? ""}`);

  let occurrences: Date[] = [start];
  if (vevent.rrule) {
    const from = new Date(
      Date.now() - RECURRENCE_PAST_DAYS * 24 * 60 * 60 * 1000,
    );
    const to = new Date(
      Date.now() + RECURRENCE_FUTURE_DAYS * 24 * 60 * 60 * 1000,
    );
    try {
      occurrences = vevent.rrule.between(from, to, true);
    } catch {
      occurrences = [start];
    }
  }

  return occurrences.slice(0, MAX_INSTANCES).map((occurrence) => {
    const startsAt = allDay ? utcMidnight(occurrence) : occurrence;
    const instanceEnd = allDay
      ? new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : new Date(occurrence.getTime() + durationMs);
    const externalId = vevent.rrule
      ? `${uid}#${startsAt.toISOString()}`
      : uid;
    return {
      externalId,
      title,
      description,
      location,
      startsAt,
      endsAt: instanceEnd,
      allDay,
      busy,
      status,
    };
  });
}

export class CalendarService {
  /**
   * Events the user owns, including their share settings and RSVPs.
   */
  async listMyEvents(
    userId: string,
    range: { from: Date; to: Date },
  ): Promise<CalendarEventView[]> {
    const events = await prisma.calendarEvent.findMany({
      where: {
        ownerId: userId,
        startsAt: { lt: range.to },
        endsAt: { gte: range.from },
      },
      include: ownerInclude,
      orderBy: { startsAt: "asc" },
    });

    return (events as unknown as EventRecord[]).map((event) =>
      toEventView(event, userId, "owner"),
    );
  }

  /**
   * Events owned by other people and shared with a group the user belongs to.
   */
  async listSharedWithMe(
    userId: string,
    range: { from: Date; to: Date },
  ): Promise<CalendarEventView[]> {
    const events = await prisma.calendarEvent.findMany({
      where: {
        ownerId: { not: userId },
        status: { not: "cancelled" },
        startsAt: { lt: range.to },
        endsAt: { gte: range.from },
        shares: {
          some: { group: { members: { some: { userId } } } },
        },
      },
      include: sharedInclude(userId),
      orderBy: { startsAt: "asc" },
    });

    return (events as unknown as EventRecord[])
      .map((event) => {
        const visibility = strongestVisibility(event.shares);
        if (!visibility) return null;
        // A free event shared as "busy" should not appear at all.
        if (visibility === "busy" && !event.busy) return null;
        return toEventView(event, userId, visibility);
      })
      .filter((event): event is CalendarEventView => event !== null);
  }

  async listCalendar(
    userId: string,
    range: { from: Date; to: Date },
  ): Promise<CalendarEventView[]> {
    const [mine, shared] = await Promise.all([
      this.listMyEvents(userId, range),
      this.listSharedWithMe(userId, range),
    ]);
    return [...mine, ...shared].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  }

  async getEventForUser(
    eventId: string,
    userId: string,
  ): Promise<CalendarEventView> {
    const base = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!base) throw new Error("Event not found");

    if (base.ownerId === userId) {
      return this.getOwnerEvent(eventId, userId);
    }

    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        shares: { some: { group: { members: { some: { userId } } } } },
      },
      include: sharedInclude(userId),
    });
    if (!event) throw new Error("Event not found or not shared with you");

    const record = event as unknown as EventRecord;
    const visibility = strongestVisibility(record.shares);
    if (!visibility || (visibility === "busy" && !record.busy)) {
      throw new Error("Event not found or not shared with you");
    }
    return toEventView(record, userId, visibility);
  }

  private async getOwnerEvent(
    eventId: string,
    userId: string,
  ): Promise<CalendarEventView> {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, ownerId: userId },
      include: ownerInclude,
    });
    if (!event) throw new Error("Event not found");
    return toEventView(event as unknown as EventRecord, userId, "owner");
  }

  async createEvent(
    userId: string,
    input: CreateEventInput,
  ): Promise<CalendarEventView> {
    const title = normalizeTitle(input.title);
    const allDay = input.allDay ?? false;
    let startsAt = parseDate(input.startsAt, "Start time");
    let endsAt = parseDate(input.endsAt, "End time");
    if (allDay) {
      ({ startsAt, endsAt } = normalizeAllDayRange(startsAt, endsAt));
    }
    ({ startsAt, endsAt } = validateRange(startsAt, endsAt, allDay));

    const shares = await this.validateShares(userId, input.shares ?? []);

    const event = await prisma.calendarEvent.create({
      data: {
        ownerId: userId,
        title,
        description: cleanText(input.description),
        location: cleanText(input.location),
        startsAt,
        endsAt,
        allDay,
        busy: input.busy ?? true,
        source: "app",
        shares: shares.length
          ? { create: shares.map((share) => ({ ...share })) }
          : undefined,
      },
      include: ownerInclude,
    });

    return toEventView(event as unknown as EventRecord, userId, "owner");
  }

  async updateEvent(
    eventId: string,
    userId: string,
    input: UpdateEventInput,
  ): Promise<CalendarEventView> {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        busy: true,
      },
    });
    if (!existing) throw new Error("Event not found");
    if (existing.ownerId !== userId) {
      throw new Error("Only the event owner can edit this event");
    }

    const title =
      input.title === undefined ? existing.title : normalizeTitle(input.title);
    const allDay = input.allDay ?? existing.allDay;
    let startsAt =
      input.startsAt === undefined
        ? existing.startsAt
        : parseDate(input.startsAt, "Start time");
    let endsAt =
      input.endsAt === undefined
        ? existing.endsAt
        : parseDate(input.endsAt, "End time");
    if (allDay) {
      ({ startsAt, endsAt } = normalizeAllDayRange(startsAt, endsAt));
    }
    ({ startsAt, endsAt } = validateRange(startsAt, endsAt, allDay));

    const shares =
      input.shares === undefined
        ? undefined
        : await this.validateShares(userId, input.shares);

    await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: eventId },
        data: {
          title,
          startsAt,
          endsAt,
          allDay,
          ...(input.description !== undefined && {
            description: cleanText(input.description),
          }),
          ...(input.location !== undefined && {
            location: cleanText(input.location),
          }),
          ...(input.busy !== undefined && { busy: input.busy }),
        },
      });

      if (shares) {
        await tx.calendarEventShare.deleteMany({ where: { eventId } });
        if (shares.length) {
          await tx.calendarEventShare.createMany({
            data: shares.map((share) => ({ eventId, ...share })),
          });
        }
      }
    });

    return this.getOwnerEvent(eventId, userId);
  }

  async deleteEvent(
    eventId: string,
    userId: string,
  ): Promise<{ success: true; eventId: string }> {
    const result = await prisma.calendarEvent.deleteMany({
      where: { id: eventId, ownerId: userId },
    });
    if (result.count === 0) {
      throw new Error("Event not found or you are not the owner");
    }
    return { success: true, eventId };
  }

  async setShares(
    eventId: string,
    userId: string,
    shares: EventShareInput[],
  ): Promise<CalendarEventView> {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!existing) throw new Error("Event not found");
    if (existing.ownerId !== userId) {
      throw new Error("Only the event owner can change who sees this event");
    }

    const validated = await this.validateShares(userId, shares);

    await prisma.$transaction(async (tx) => {
      await tx.calendarEventShare.deleteMany({ where: { eventId } });
      if (validated.length) {
        await tx.calendarEventShare.createMany({
          data: validated.map((share) => ({ eventId, ...share })),
        });
      }
    });

    return this.getOwnerEvent(eventId, userId);
  }

  async rsvpEvent(
    eventId: string,
    userId: string,
    response: RsvpResponse,
  ): Promise<CalendarEventView> {
    if (response !== "yes" && response !== "no") {
      throw new Error('RSVP response must be "yes" or "no"');
    }

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        shares: {
          where: {
            visibility: "details",
            group: { members: { some: { userId } } },
          },
          select: { id: true },
        },
      },
    });
    if (!event) throw new Error("Event not found");
    if (event.ownerId === userId) {
      throw new Error("You are hosting this event");
    }
    if (event.shares.length === 0) {
      throw new Error("Only people invited with full details can RSVP");
    }

    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, response },
      update: { response },
    });

    return this.getEventForUser(eventId, userId);
  }

  async listRsvps(
    eventId: string,
    userId: string,
  ): Promise<NonNullable<CalendarEventView["rsvps"]>> {
    const event = await this.getEventForUser(eventId, userId);
    if (event.visibility === "busy") {
      throw new Error("You do not have access to this event's RSVPs");
    }
    return event.visibility === "owner"
      ? (event.invitees ?? []).map((invitee) => ({
          userId: invitee.userId,
          name: invitee.name,
          email: invitee.email,
          response: invitee.response,
        }))
      : (event.rsvps ?? []);
  }

  /**
   * Imports events from ICS text. Existing imports with the same UID are
   * updated in place, so a second upload does not duplicate events.
   */
  async importIcs(
    userId: string,
    options: {
      icsText: string;
      source?: string;
      subscriptionId?: number | null;
      removeStale?: boolean;
    },
  ): Promise<ImportResult & { events: CalendarEventView[] }> {
    const text = options.icsText?.trim();
    if (!text) throw new Error("Calendar data is empty");
    if (text.length > 5_000_000) {
      throw new Error("Calendar file is too large");
    }

    const source = (options.source ?? "ics").slice(0, 40);
    let parsed: Record<string, { type?: string }>;
    try {
      parsed = ical.sync.parseICS(text) as unknown as Record<
        string,
        { type?: string }
      >;
    } catch {
      throw new Error("Could not read that calendar file");
    }

    const instances: ParsedInstance[] = [];
    for (const component of Object.values(parsed)) {
      if (component?.type !== "VEVENT") continue;
      instances.push(...expandVEvent(component as unknown as VEvent));
      if (instances.length >= MAX_INSTANCES) break;
    }

    if (instances.length === 0) {
      throw new Error("No events were found in that calendar");
    }

    const uniqueInstances = new Map<string, ParsedInstance>();
    for (const instance of instances) {
      uniqueInstances.set(instance.externalId, instance);
    }
    const parsedInstances = [...uniqueInstances.values()];
    const externalIds = parsedInstances.map((instance) => instance.externalId);

    const existing = await prisma.calendarEvent.findMany({
      where: {
        ownerId: userId,
        source,
        externalId: { in: externalIds },
      },
      select: { id: true, externalId: true },
    });
    const existingByExternalId = new Map(
      existing.map((row) => [row.externalId ?? "", row.id]),
    );

    const toCreate = parsedInstances.filter(
      (instance) => !existingByExternalId.has(instance.externalId),
    );
    const toUpdate = parsedInstances.filter((instance) =>
      existingByExternalId.has(instance.externalId),
    );

    if (toCreate.length > 0) {
      await prisma.calendarEvent.createMany({
        data: toCreate.map((instance) => ({
          ownerId: userId,
          source,
          externalId: instance.externalId,
          title: instance.title,
          description: instance.description,
          location: instance.location,
          startsAt: instance.startsAt,
          endsAt: instance.endsAt,
          allDay: instance.allDay,
          busy: instance.busy,
          status: instance.status,
          subscriptionId: options.subscriptionId ?? null,
        })),
      });
    }

    await Promise.all(
      toUpdate.map((instance) => {
        const id = existingByExternalId.get(instance.externalId) as string;
        return prisma.calendarEvent.update({
          where: { id },
          data: {
            title: instance.title,
            description: instance.description,
            location: instance.location,
            startsAt: instance.startsAt,
            endsAt: instance.endsAt,
            allDay: instance.allDay,
            busy: instance.busy,
            status: instance.status,
            subscriptionId: options.subscriptionId ?? null,
          },
        });
      }),
    );

    const imported = toCreate.length;
    const updated = toUpdate.length;

    let removed = 0;
    if (options.removeStale && options.subscriptionId) {
      const stale = await prisma.calendarEvent.deleteMany({
        where: {
          subscriptionId: options.subscriptionId,
          externalId: { notIn: externalIds },
        },
      });
      removed = stale.count;
    }

    return {
      source,
      imported,
      updated,
      removed,
      skipped: 0,
      events: [],
    };
  }

  async listSubscriptions(userId: string): Promise<CalendarSubscriptionView[]> {
    const subscriptions = await prisma.calendarSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return subscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      url: subscription.url,
      lastSyncedAt: subscription.lastSyncedAt?.toISOString() ?? null,
      lastError: subscription.lastError,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    }));
  }

  async addSubscription(
    userId: string,
    input: { name: string; url: string; sync?: boolean },
  ): Promise<{
    subscription: CalendarSubscriptionView;
    sync: ImportResult | null;
    syncError: string | null;
  }> {
    const name = cleanText(input.name, 80);
    if (!name) throw new Error("Give the calendar a name");
    const url = normalizeSubscriptionUrl(input.url);
    await assertSafeSubscriptionUrl(url);

    const subscription = await prisma.calendarSubscription.upsert({
      where: { userId_url: { userId, url } },
      create: { userId, name, url },
      update: { name },
    });

    let sync: ImportResult | null = null;
    let syncError: string | null = null;
    if (input.sync !== false) {
      try {
        sync = await this.syncSubscription(subscription.id, userId);
      } catch (error) {
        syncError =
          error instanceof Error ? error.message : "Could not sync calendar";
      }
    }

    return {
      subscription: {
        id: subscription.id,
        name: subscription.name,
        url: subscription.url,
        lastSyncedAt: sync ? new Date().toISOString() : null,
        lastError: syncError,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
      },
      sync,
      syncError,
    };
  }

  async syncSubscription(
    subscriptionId: number,
    userId: string,
  ): Promise<ImportResult> {
    const subscription = await prisma.calendarSubscription.findFirst({
      where: { id: subscriptionId, userId },
    });
    if (!subscription) throw new Error("Calendar subscription not found");

    try {
      const response = await fetch(subscription.url, {
        headers: { accept: "text/calendar, text/plain, */*" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`Calendar responded with ${response.status}`);
      }
      const text = await response.text();
      const result = await this.importIcs(userId, {
        icsText: text,
        source: `ics:${subscription.id}`,
        subscriptionId: subscription.id,
        removeStale: true,
      });

      await prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not sync calendar";
      await prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: { lastError: message },
      });
      throw new Error(message);
    }
  }

  async removeSubscription(
    subscriptionId: number,
    userId: string,
  ): Promise<{ success: true; subscriptionId: number }> {
    const result = await prisma.calendarSubscription.deleteMany({
      where: { id: subscriptionId, userId },
    });
    if (result.count === 0) throw new Error("Calendar subscription not found");
    return { success: true, subscriptionId };
  }

  private async validateShares(
    userId: string,
    shares: EventShareInput[],
  ): Promise<EventShareInput[]> {
    if (shares.length === 0) return [];

    const unique = new Map<number, CalendarVisibility>();
    for (const share of shares) {
      if (!Number.isInteger(share.groupId) || share.groupId <= 0) {
        throw new Error("Each share needs a valid group id");
      }
      unique.set(share.groupId, assertVisibility(share.visibility));
    }

    const groupIds = [...unique.keys()];
    const memberships = await prisma.groupMember.findMany({
      where: { userId, groupId: { in: groupIds } },
      select: { groupId: true },
    });
    const memberOf = new Set(memberships.map((row) => row.groupId));
    const missing = groupIds.filter((groupId) => !memberOf.has(groupId));
    if (missing.length > 0) {
      throw new Error("You can only share with groups you belong to");
    }

    return groupIds.map((groupId) => ({
      groupId,
      visibility: unique.get(groupId) as CalendarVisibility,
    }));
  }

  /**
   * Builds a share list from the groups the user belongs to. Used by the UI
   * when creating an event that should default to sharing with every group.
   */
  async defaultShares(
    userId: string,
    visibility: CalendarVisibility,
  ): Promise<EventShareInput[]> {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((row) => ({
      groupId: row.groupId,
      visibility,
    }));
  }

  async canView(eventId: string, userId: string): Promise<boolean> {
    return CalendarPolicy.canView(userId, eventId);
  }
}

export const calendarService = new CalendarService();
