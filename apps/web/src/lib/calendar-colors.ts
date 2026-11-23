export const CALENDAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
] as const;

export const DEFAULT_PERSONAL_COLOR = CALENDAR_COLORS[0];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeColor(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return isHexColor(trimmed) ? trimmed.toLowerCase() : null;
}

export function defaultGroupColor(groupId: number): string {
  const index = Math.abs(groupId) % CALENDAR_COLORS.length;
  return CALENDAR_COLORS[index];
}
