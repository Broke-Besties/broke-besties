import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import { preferencesService } from "@/services/preferences.service";
import { LENDER_ID, MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

const base = {
  theme: "system",
  calendar: {
    timezone: "America/Toronto",
    personalColor: "#6366f1",
    groupColors: { "4": "#ef4444" },
  },
};

describe("preferencesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads preferences with defaults", async () => {
    db.user.findUnique.mockResolvedValueOnce({ preferences: null });

    const preferences = await preferencesService.get(LENDER_ID);

    expect(preferences.calendar.personalColor).toMatch(/^#/);
    expect(preferences.theme).toBe("system");
  });

  it("merges a theme change without losing calendar preferences", async () => {
    db.user.findUnique.mockResolvedValueOnce({ preferences: base });
    db.user.update.mockResolvedValueOnce({});

    const preferences = await preferencesService.setTheme(LENDER_ID, "dark");

    expect(preferences.theme).toBe("dark");
    expect(preferences.calendar.groupColors).toEqual({ "4": "#ef4444" });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: LENDER_ID },
      data: {
        preferences: expect.objectContaining({
          theme: "dark",
          calendar: expect.objectContaining({
            timezone: "America/Toronto",
            groupColors: { "4": "#ef4444" },
          }),
        }),
      },
    });
  });

  it("merges calendar patches and clears colors set to null", async () => {
    db.user.findUnique.mockResolvedValueOnce({ preferences: base });
    db.user.update.mockResolvedValueOnce({});

    const preferences = await preferencesService.updateCalendar(LENDER_ID, {
      timezone: "Europe/London",
      personalColor: "#10b981",
      groupColors: { "4": null, "7": "#f59e0b" },
    });

    expect(preferences.calendar).toEqual({
      timezone: "Europe/London",
      personalColor: "#10b981",
      groupColors: { "7": "#f59e0b" },
    });
  });
});
