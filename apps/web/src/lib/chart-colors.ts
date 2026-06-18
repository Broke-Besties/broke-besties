// Shared categorical chart palette backed by the shadcn theme tokens
// (--chart-1 … --chart-5). Used by every recharts chart so colors stay
// consistent and follow the active theme.
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
