import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_PREFERENCES,
  parseUserPreferences,
} from "./user-preferences";

describe("parseUserPreferences", () => {
  it("returns defaults for missing values", () => {
    expect(parseUserPreferences(null)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(parseUserPreferences("nope")).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it("parses theme, timezone, and valid colors", () => {
    expect(
      parseUserPreferences({
        theme: "dark",
        calendar: {
          timezone: "America/Toronto",
          personalColor: "#10B981",
          groupColors: { "4": "#EF4444", bad: "#000000", "5": "red" },
        },
      }),
    ).toEqual({
      theme: "dark",
      calendar: {
        timezone: "America/Toronto",
        personalColor: "#10b981",
        groupColors: { "4": "#ef4444" },
      },
    });
  });

  it("falls back to system theme for unknown values", () => {
    expect(parseUserPreferences({ theme: "sepia" }).theme).toBe("system");
  });
});
