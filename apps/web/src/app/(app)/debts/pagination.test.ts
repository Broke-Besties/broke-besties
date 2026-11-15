import { describe, expect, it } from "vitest";
import { pageBounds } from "./pagination";

describe("debt pagination", () => {
  it("shows ten debts per page without gaps or duplicates", () => {
    const debts = Array.from({ length: 360 }, (_, i) => i);
    const pages = Array.from({ length: 36 }, (_, i) => {
      const { start, end } = pageBounds(debts.length, i + 1, 10);
      expect(end - start).toBe(10);
      return debts.slice(start, end);
    });
    expect(pages.flat()).toEqual(debts);
  });
  it("clamps the page after results shrink and handles the final partial page", () => {
    expect(pageBounds(23, 36, 10)).toEqual({
      page: 3,
      pageCount: 3,
      start: 20,
      end: 23,
    });
    expect(pageBounds(360, 8, 50)).toEqual({
      page: 8,
      pageCount: 8,
      start: 350,
      end: 360,
    });
  });
  it("handles empty results and the first page", () => {
    expect(pageBounds(0, 4, 10)).toEqual({
      page: 1,
      pageCount: 1,
      start: 0,
      end: 0,
    });
    expect(pageBounds(25, 0, 25)).toEqual({
      page: 1,
      pageCount: 1,
      start: 0,
      end: 25,
    });
  });
});
