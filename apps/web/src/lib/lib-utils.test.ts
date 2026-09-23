import { describe, expect, it } from "vitest";
import { CHART_COLORS, chartColor } from "@/lib/chart-colors";
import { isSettingsPath } from "@/lib/nav";
import { cn } from "@/lib/utils";

describe("chartColor", () => {
  it("maps indexes to theme tokens in order", () => {
    expect(chartColor(0)).toBe(CHART_COLORS[0]);
    expect(chartColor(4)).toBe(CHART_COLORS[4]);
  });

  it("wraps around after the last color", () => {
    expect(chartColor(5)).toBe(CHART_COLORS[0]);
    expect(chartColor(7)).toBe(CHART_COLORS[2]);
  });
});

describe("isSettingsPath", () => {
  it("detects settings paths", () => {
    expect(isSettingsPath("/profile")).toBe(true);
    expect(isSettingsPath("/profile/edit")).toBe(true);
  });

  it("rejects non-settings paths", () => {
    expect(isSettingsPath("/dashboard")).toBe(false);
    expect(isSettingsPath("/debts")).toBe(false);
    expect(isSettingsPath("/")).toBe(false);
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("filters falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("resolves conflicts with tailwind-merge", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles conditional objects", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });
});
