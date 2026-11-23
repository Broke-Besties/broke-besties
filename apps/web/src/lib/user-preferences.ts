import {
  DEFAULT_PERSONAL_COLOR,
  normalizeColor,
} from "@/lib/calendar-colors";

export type ThemePreference = "light" | "dark" | "system";

export type CalendarPreferences = {
  timezone: string | null;
  personalColor: string;
  /** Group id (as a string key) to hex color. */
  groupColors: Record<string, string>;
};

export type UserPreferences = {
  theme: ThemePreference;
  calendar: CalendarPreferences;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: "system",
  calendar: {
    timezone: null,
    personalColor: DEFAULT_PERSONAL_COLOR,
    groupColors: {},
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

function parseGroupColors(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const colors: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!/^\d+$/.test(key)) continue;
    const color =
      typeof raw === "string" ? normalizeColor(raw) : null;
    if (color) colors[key] = color;
  }
  return colors;
}

export function parseUserPreferences(value: unknown): UserPreferences {
  const root = isRecord(value) ? value : {};
  const calendar = isRecord(root.calendar) ? root.calendar : {};
  return {
    theme: parseTheme(root.theme),
    calendar: {
      timezone:
        typeof calendar.timezone === "string" && calendar.timezone.trim()
          ? calendar.timezone
          : null,
      personalColor:
        normalizeColor(
          typeof calendar.personalColor === "string"
            ? calendar.personalColor
            : null,
        ) ?? DEFAULT_PERSONAL_COLOR,
      groupColors: parseGroupColors(calendar.groupColors),
    },
  };
}

export function withTheme(
  preferences: UserPreferences,
  theme: ThemePreference,
): UserPreferences {
  return { ...preferences, theme };
}
