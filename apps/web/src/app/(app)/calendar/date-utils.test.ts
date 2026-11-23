import { describe, expect, it } from "vitest";

import {
  formatEventRange,
  isoToZonedDateTimeLocal,
  shiftAllDayKey,
  zonedDateTimeToUtc,
  zonedDayKey,
  zonedDayRange,
} from "./date-utils";

describe("calendar timezone helpers", () => {
  it("converts wall-clock time in a winter timezone to UTC", () => {
    expect(
      zonedDateTimeToUtc("2026-01-15T18:00", "America/Toronto"),
    ).toBe("2026-01-15T23:00:00.000Z");
  });

  it("uses the daylight-saving offset in summer", () => {
    expect(
      zonedDateTimeToUtc("2026-07-15T18:00", "America/Toronto"),
    ).toBe("2026-07-15T22:00:00.000Z");
  });

  it("formats an instant back into the selected timezone", () => {
    expect(
      isoToZonedDateTimeLocal(
        "2026-01-16T03:00:00.000Z",
        "America/Toronto",
      ),
    ).toBe("2026-01-15T22:00");
  });

  it("assigns an instant to the right local calendar day", () => {
    expect(
      zonedDayKey("2026-01-16T03:00:00.000Z", "America/Toronto"),
    ).toBe("2026-01-15");
    expect(
      zonedDayKey("2026-01-16T03:00:00.000Z", "Europe/London"),
    ).toBe("2026-01-16");
  });

  it("builds the local day range", () => {
    const range = zonedDayRange("2026-01-15", "America/Toronto");
    expect(new Date(range.start).toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
    expect(new Date(range.end).toISOString()).toBe("2026-01-16T05:00:00.000Z");
  });

  it("keeps all-day keys timezone independent", () => {
    expect(shiftAllDayKey("2026-01-15", 1)).toBe("2026-01-16");
    expect(
      formatEventRange(
        "2026-01-15T00:00:00.000Z",
        "2026-01-16T00:00:00.000Z",
        true,
        "America/Toronto",
      ),
    ).toBe("All day");
  });
});
