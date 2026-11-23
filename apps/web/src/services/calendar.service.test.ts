import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import { calendarService } from "@/services/calendar.service";
import {
  BORROWER_ID,
  LENDER_ID,
  MockPrisma,
  makeUser,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    ownerId: LENDER_ID,
    title: "Dinner",
    description: "Pasta",
    location: "Mara's",
    startsAt: new Date("2026-09-01T18:00:00.000Z"),
    endsAt: new Date("2026-09-01T19:00:00.000Z"),
    allDay: false,
    busy: true,
    status: "confirmed",
    source: "app",
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
    owner: makeUser(),
    shares: [],
    rsvps: [],
    ...overrides,
  };
}

describe("calendarService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEvent", () => {
    it("requires a title", async () => {
      await expect(
        calendarService.createEvent(LENDER_ID, {
          title: "  ",
          startsAt: new Date("2026-09-01T18:00:00.000Z"),
          endsAt: new Date("2026-09-01T19:00:00.000Z"),
        }),
      ).rejects.toThrow("Event title is required");
      expect(db.calendarEvent.create).not.toHaveBeenCalled();
    });

    it("rejects an end before the start", async () => {
      await expect(
        calendarService.createEvent(LENDER_ID, {
          title: "Dinner",
          startsAt: new Date("2026-09-01T19:00:00.000Z"),
          endsAt: new Date("2026-09-01T18:00:00.000Z"),
        }),
      ).rejects.toThrow("Event end must be after its start");
    });

    it("creates an event with validated group shares", async () => {
      const created = makeEvent({
        shares: [
          {
            visibility: "busy",
            allowRsvp: false,
            group: { id: 4, name: "Besties", members: [] },
          },
        ],
      });
      db.groupMember.findMany.mockResolvedValueOnce([{ groupId: 4 }]);
      db.calendarEvent.create.mockResolvedValueOnce(created);
      db.calendarEvent.findFirst.mockResolvedValueOnce(created);
      db.user.findUnique.mockResolvedValueOnce({ preferences: null });

      const event = await calendarService.createEvent(LENDER_ID, {
        title: "Dinner",
        description: "Pasta",
        location: "Mara's",
        startsAt: "2026-09-01T18:00:00.000Z",
        endsAt: "2026-09-01T19:00:00.000Z",
        shares: [{ groupId: 4, visibility: "busy" }],
      });

      expect(db.calendarEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: LENDER_ID,
            title: "Dinner",
            source: "app",
            shares: {
              create: [{ groupId: 4, visibility: "busy", allowRsvp: false }],
            },
          }),
        }),
      );
      expect(event.title).toBe("Dinner");
      expect(event.visibility).toBe("owner");
    });

    it("refuses to share with a group the user is not in", async () => {
      db.groupMember.findMany.mockResolvedValueOnce([]);

      await expect(
        calendarService.createEvent(LENDER_ID, {
          title: "Dinner",
          startsAt: "2026-09-01T18:00:00.000Z",
          endsAt: "2026-09-01T19:00:00.000Z",
          shares: [{ groupId: 99, visibility: "details" }],
        }),
      ).rejects.toThrow("You can only share with groups you belong to");
      expect(db.calendarEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("listSharedWithMe", () => {
    it("redacts busy events and hides busy free events", async () => {
      db.calendarEvent.findMany.mockResolvedValueOnce([
        makeEvent({
          id: "evt-busy",
          ownerId: BORROWER_ID,
          owner: makeUser({ id: BORROWER_ID, name: "Alex" }),
          shares: [
            {
              visibility: "busy",
              group: { id: 4, name: "Besties" },
            },
          ],
        }),
        makeEvent({
          id: "evt-free",
          ownerId: BORROWER_ID,
          busy: false,
          shares: [
            {
              visibility: "busy",
              group: { id: 4, name: "Besties" },
            },
          ],
        }),
      ]);

      const events = await calendarService.listSharedWithMe(LENDER_ID, {
        from: new Date("2026-09-01T00:00:00.000Z"),
        to: new Date("2026-09-30T00:00:00.000Z"),
      });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: "evt-busy",
        title: "Busy",
        description: null,
        location: null,
        visibility: "busy",
      });
    });
  });

  describe("rsvpEvent", () => {
    it("rejects the event owner", async () => {
      db.calendarEvent.findUnique.mockResolvedValueOnce({
        ownerId: LENDER_ID,
        shares: [{ id: 1 }],
      });

      await expect(
        calendarService.rsvpEvent("evt-1", LENDER_ID, "yes"),
      ).rejects.toThrow("You are hosting this event");
    });

    it("rejects people who only have busy visibility", async () => {
      db.calendarEvent.findUnique.mockResolvedValueOnce({
        ownerId: BORROWER_ID,
        shares: [],
      });

      await expect(
        calendarService.rsvpEvent("evt-1", LENDER_ID, "yes"),
      ).rejects.toThrow("RSVPs are closed for this event");
    });

    it("upserts the response for a detail-shared invitee", async () => {
      db.calendarEvent.findUnique.mockResolvedValueOnce({
        ownerId: BORROWER_ID,
        shares: [{ id: 1 }],
      });
      db.eventRsvp.upsert.mockResolvedValueOnce({});
      db.calendarEvent.findUnique.mockResolvedValueOnce({
        ownerId: BORROWER_ID,
      });
      db.calendarEvent.findFirst.mockResolvedValueOnce(
        makeEvent({
          ownerId: BORROWER_ID,
          shares: [
            {
              visibility: "details",
              group: { id: 4, name: "Besties" },
            },
          ],
          rsvps: [{ response: "yes", user: makeUser() }],
        }),
      );

      const event = await calendarService.rsvpEvent("evt-1", LENDER_ID, "yes");

      expect(db.eventRsvp.upsert).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: "evt-1", userId: LENDER_ID } },
        create: { eventId: "evt-1", userId: LENDER_ID, response: "yes" },
        update: { response: "yes" },
      });
      expect(event.rsvp).toBe("yes");
    });
  });

  describe("importIcs", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc-123",
      "DTSTART:20260101T180000Z",
      "DTEND:20260101T190000Z",
      "SUMMARY:Dinner",
      "LOCATION:Home",
      "DESCRIPTION:Pasta night",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    it("parses a new event and creates it", async () => {
      db.calendarEvent.findMany.mockResolvedValueOnce([]);
      db.calendarEvent.createMany.mockResolvedValueOnce({ count: 1 });

      const result = await calendarService.importIcs(LENDER_ID, { icsText: ics });

      expect(result).toMatchObject({ imported: 1, updated: 0 });
      expect(db.calendarEvent.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            ownerId: LENDER_ID,
            source: "ics",
            externalId: "abc-123",
            title: "Dinner",
            location: "Home",
          }),
        ],
      });
    });

    it("updates an existing import instead of duplicating it", async () => {
      db.calendarEvent.findMany.mockResolvedValueOnce([
        { id: "evt-1", externalId: "abc-123" },
      ]);
      db.calendarEvent.update.mockResolvedValueOnce({});

      const result = await calendarService.importIcs(LENDER_ID, { icsText: ics });

      expect(result).toMatchObject({ imported: 0, updated: 1 });
      expect(db.calendarEvent.update).toHaveBeenCalledWith({
        where: { id: "evt-1" },
        data: expect.objectContaining({ title: "Dinner" }),
      });
    });

    it("stores all-day events at UTC midnight", async () => {
      const allDayIcs = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:holiday",
        "DTSTART;VALUE=DATE:20260101",
        "DTEND;VALUE=DATE:20260102",
        "SUMMARY:New Year",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");
      db.calendarEvent.findMany.mockResolvedValueOnce([]);
      db.calendarEvent.createMany.mockResolvedValueOnce({ count: 1 });

      await calendarService.importIcs(LENDER_ID, { icsText: allDayIcs });

      const payload = db.calendarEvent.createMany.mock.calls[0][0] as {
        data: Array<{ startsAt: Date; endsAt: Date; allDay: boolean }>;
      };
      expect(payload.data[0].allDay).toBe(true);
      expect(payload.data[0].startsAt.toISOString()).toBe(
        "2026-01-01T00:00:00.000Z",
      );
      expect(payload.data[0].endsAt.toISOString()).toBe(
        "2026-01-02T00:00:00.000Z",
      );
    });

    it("rejects empty calendar data", async () => {
      await expect(
        calendarService.importIcs(LENDER_ID, { icsText: "   " }),
      ).rejects.toThrow("Calendar data is empty");
    });
  });

  describe("timezone and colors", () => {
    it("rejects unknown timezones", async () => {
      await expect(
        calendarService.setTimezone(LENDER_ID, "Mars/Olympus_Mons"),
      ).rejects.toThrow("Unknown timezone");
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it("saves a valid timezone in preferences", async () => {
      db.user.update.mockResolvedValueOnce({});
      db.user.findUnique.mockResolvedValueOnce({
        preferences: {
          theme: "dark",
          calendar: {
            timezone: null,
            personalColor: "#ef4444",
            groupColors: {},
          },
        },
      });
      db.user.findUnique.mockResolvedValueOnce({
        preferences: {
          theme: "dark",
          calendar: {
            timezone: "America/Toronto",
            personalColor: "#ef4444",
            groupColors: {},
          },
        },
      });

      const settings = await calendarService.setTimezone(
        LENDER_ID,
        "America/Toronto",
      );

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: LENDER_ID },
        data: {
          preferences: expect.objectContaining({
            theme: "dark",
            calendar: expect.objectContaining({
              timezone: "America/Toronto",
              personalColor: "#ef4444",
            }),
          }),
        },
      });
      expect(settings.timezone).toBe("America/Toronto");
      expect(settings.personalColor).toBe("#ef4444");
    });

    it("falls back to a stable default color per group", async () => {
      db.user.findUnique.mockResolvedValueOnce({ preferences: null });
      db.group.findMany.mockResolvedValueOnce([
        {
          id: 7,
          name: "Roommates",
          _count: { members: 2 },
        },
      ]);

      const [group] = await calendarService.listGroupOptions(LENDER_ID);

      expect(group).toMatchObject({ id: 7, name: "Roommates", memberCount: 2 });
      expect(group.color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("saves personal and per-group colors in preferences", async () => {
      const saved = {
        theme: "system",
        calendar: {
          timezone: "America/Toronto",
          personalColor: "#10b981",
          groupColors: { "4": "#ef4444" },
        },
      };
      db.groupMember.findMany.mockResolvedValueOnce([{ groupId: 4 }]);
      db.user.findUnique.mockResolvedValue({
        preferences: saved,
      });
      db.user.findUnique.mockResolvedValueOnce({
        preferences: {
          theme: "system",
          calendar: {
            timezone: "America/Toronto",
            personalColor: "#6366f1",
            groupColors: {},
          },
        },
      });
      db.user.update.mockResolvedValueOnce({});
      db.group.findMany.mockResolvedValueOnce([
        {
          id: 4,
          name: "Besties",
          _count: { members: 3 },
        },
      ]);

      const result = await calendarService.setColors(LENDER_ID, {
        personalColor: "#10b981",
        groups: [{ groupId: 4, color: "#ef4444" }],
      });

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: LENDER_ID },
        data: {
          preferences: expect.objectContaining({
            calendar: expect.objectContaining({
              personalColor: "#10b981",
              groupColors: { "4": "#ef4444" },
            }),
          }),
        },
      });
      expect(result.settings.personalColor).toBe("#10b981");
      expect(result.groups[0].color).toBe("#ef4444");
    });

    it("rejects invalid color values", async () => {
      await expect(
        calendarService.setColors(LENDER_ID, { personalColor: "red" }),
      ).rejects.toThrow("Colors must be hex values");
    });
  });

  describe("addSubscription", () => {
    it("rejects internal hosts", async () => {
      await expect(
        calendarService.addSubscription(LENDER_ID, {
          name: "Local",
          url: "http://localhost/calendar.ics",
        }),
      ).rejects.toThrow("Calendar URL must be publicly reachable");
      expect(db.calendarSubscription.upsert).not.toHaveBeenCalled();
    });

    it("normalizes webcal URLs", async () => {
      db.calendarSubscription.findMany.mockResolvedValueOnce([]);

      await expect(
        calendarService.addSubscription(LENDER_ID, {
          name: "Apple",
          url: "webcal://localhost/calendar.ics",
          sync: false,
        }),
      ).rejects.toThrow("Calendar URL must be publicly reachable");
    });
  });
});
