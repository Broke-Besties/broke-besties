// Run: npx tsx src/lib/chart-series.test.ts
import assert from "node:assert";
import { bucketByMonth } from "./chart-series";

const now = new Date();
const thisMonth = (day = 15) =>
  new Date(now.getFullYear(), now.getMonth(), day);
const monthsAgo = (m: number) =>
  new Date(now.getFullYear(), now.getMonth() - m, 15);

// empty input → n all-zero rows
const empty = bucketByMonth<{ d: Date; v: number }>([], 6, (t) => t.d, {
  v: (t) => t.v,
});
assert.strictEqual(empty.length, 6, "should return n rows");
assert.ok(empty.every((r) => r.v === 0), "empty input → all zero");

// items land in the right month and sum
const rows = bucketByMonth(
  [
    { d: thisMonth(), v: 10 },
    { d: thisMonth(2), v: 5 },
    { d: monthsAgo(2), v: 7 },
  ],
  6,
  (t) => t.d,
  { v: (t) => t.v },
);
assert.strictEqual(rows[rows.length - 1].v, 15, "current month sums to 15");
assert.strictEqual(rows[rows.length - 3].v, 7, "two months ago is 7");

// out-of-window items are ignored
const out = bucketByMonth([{ d: monthsAgo(12), v: 99 }], 6, (t) => t.d, {
  v: (t) => t.v,
});
assert.ok(out.every((r) => r.v === 0), "out-of-window ignored");

// multiple series tracked independently
const multi = bucketByMonth([{ d: thisMonth(), a: 3, b: 4 }], 3, (t) => t.d, {
  a: (t) => t.a,
  b: (t) => t.b,
});
assert.strictEqual(multi[multi.length - 1].a, 3);
assert.strictEqual(multi[multi.length - 1].b, 4);

console.log("chart-series: all assertions passed");
