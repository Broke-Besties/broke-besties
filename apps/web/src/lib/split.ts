/**
 * Split a money total evenly into `n` shares, in cents, so the shares sum
 * exactly to `total`. The last share absorbs the rounding remainder.
 * e.g. splitEvenly(100, 3) -> [33.33, 33.33, 33.34]
 */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) throw new Error("Need at least one share");
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / n);
  const shares = Array(n).fill(base);
  shares[n - 1] = totalCents - base * (n - 1); // last absorbs remainder
  return shares.map((c) => c / 100);
}

// ponytail: money path — one runnable self-check. Run: npx tsx src/lib/split.ts
if (process.argv[1] && process.argv[1].endsWith("split.ts")) {
  const sum = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) * 100) / 100;
  const a = splitEvenly(100, 3);
  console.assert(JSON.stringify(a) === "[33.33,33.33,33.34]", "even split", a);
  console.assert(sum(a) === 100, "sum 100", sum(a));
  console.assert(sum(splitEvenly(10, 4)) === 10, "sum 10/4");
  console.assert(sum(splitEvenly(0.01, 2)) === 0.01, "penny split");
  console.assert(JSON.stringify(splitEvenly(50, 1)) === "[50]", "single share");
  console.log("split.ts self-check passed");
}
