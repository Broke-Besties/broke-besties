import { describe, expect, it } from "vitest";
import { bucketByMonth } from "@/lib/chart-series";

const now = new Date();
const thisMonth = (day = 15) => new Date(now.getFullYear(), now.getMonth(), day);
const monthsAgo = (m: number) => new Date(now.getFullYear(), now.getMonth() - m, 15);

type Item = { d: Date; v: number };

describe("bucketByMonth", () => {
  it("returns n all-zero rows for empty input", () => {
    const rows = bucketByMonth<Item>([], 6, (t) => t.d, { v: (t) => t.v });

    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.v === 0)).toBe(true);
  });

  it("sums items into the correct month bucket", () => {
    const rows = bucketByMonth<Item>(
      [
        { d: thisMonth(), v: 10 },
        { d: thisMonth(2), v: 5 },
        { d: monthsAgo(2), v: 7 },
      ],
      6,
      (t) => t.d,
      { v: (t) => t.v },
    );

    expect(rows[rows.length - 1].v).toBe(15);
    expect(rows[rows.length - 3].v).toBe(7);
  });

  it("ignores items outside the window", () => {
    const rows = bucketByMonth([{ d: monthsAgo(12), v: 99 }], 6, (t) => t.d, {
      v: (t) => t.v,
    });

    expect(rows.every((r) => r.v === 0)).toBe(true);
  });

  it("ignores invalid dates", () => {
    const rows = bucketByMonth([{ d: new Date("not-a-date"), v: 5 } as Item], 3, (t) => t.d, {
      v: (t) => t.v,
    });

    expect(rows.every((r) => r.v === 0)).toBe(true);
  });

  it("accepts string dates", () => {
    const rows = bucketByMonth(
      [{ d: thisMonth().toISOString(), v: 3 }],
      2,
      (t) => t.d,
      { v: (t) => t.v },
    );

    expect(rows[rows.length - 1].v).toBe(3);
  });

  it("tracks multiple series independently", () => {
    const rows = bucketByMonth([{ d: thisMonth(), a: 3, b: 4 }], 3, (t) => t.d, {
      a: (t) => t.a,
      b: (t) => t.b,
    });

    const last = rows[rows.length - 1];
    expect(last.a).toBe(3);
    expect(last.b).toBe(4);
  });

  it("orders rows oldest to newest", () => {
    const rows = bucketByMonth<Item>([], 3, (t) => t.d, { v: (t) => t.v });

    const d0 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    expect(rows[0].month).toBe(
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
        d0.getMonth()
      ],
    );
  });
});
