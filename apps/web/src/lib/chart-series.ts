// Bucket items into the last `n` calendar months, summing one or more series.
// Returns one row per month (oldest→newest); months with no data are 0 so the
// area renders as a continuous line instead of gaps.

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export function bucketByMonth<T>(
  items: T[],
  n: number,
  getDate: (t: T) => Date | string,
  series: Record<string, (t: T) => number>,
): Array<Record<string, string | number>> {
  const now = new Date();
  const names = Object.keys(series);

  // Pre-seed the last n months in order so empty months are 0.
  const rows = new Map<string, Record<string, string | number>>();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const row: Record<string, string | number> = { month: MONTH_LABELS[d.getMonth()] };
    for (const name of names) row[name] = 0;
    rows.set(monthKey(d), row);
  }

  for (const item of items) {
    const d = new Date(getDate(item));
    if (Number.isNaN(d.getTime())) continue;
    const row = rows.get(monthKey(d));
    if (!row) continue; // outside the window
    for (const name of names) {
      row[name] = (row[name] as number) + series[name](item);
    }
  }

  return [...rows.values()];
}
