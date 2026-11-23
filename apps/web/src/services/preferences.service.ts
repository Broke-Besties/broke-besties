import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  parseUserPreferences,
  withTheme,
  type CalendarPreferences,
  type ThemePreference,
  type UserPreferences,
} from "@/lib/user-preferences";

export type CalendarPreferencesPatch = {
  timezone?: string | null;
  personalColor?: string;
  groupColors?: Record<string, string | null>;
};

export class PreferencesService {
  async get(userId: string): Promise<UserPreferences> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    return parseUserPreferences(user?.preferences);
  }

  async setTheme(
    userId: string,
    theme: ThemePreference,
  ): Promise<UserPreferences> {
    if (theme !== "light" && theme !== "dark" && theme !== "system") {
      throw new Error('Theme must be "light", "dark", or "system"');
    }
    const current = await this.get(userId);
    return this.save(userId, withTheme(current, theme));
  }

  async updateCalendar(
    userId: string,
    patch: CalendarPreferencesPatch,
  ): Promise<UserPreferences> {
    const current = await this.get(userId);
    const calendar: CalendarPreferences = { ...current.calendar };

    if (patch.timezone !== undefined) {
      calendar.timezone = patch.timezone;
    }
    if (patch.personalColor !== undefined) {
      calendar.personalColor = patch.personalColor;
    }
    if (patch.groupColors !== undefined) {
      const groupColors = { ...calendar.groupColors };
      for (const [groupId, color] of Object.entries(patch.groupColors)) {
        if (color === null) delete groupColors[groupId];
        else groupColors[groupId] = color;
      }
      calendar.groupColors = groupColors;
    }

    return this.save(userId, { ...current, calendar });
  }

  private async save(
    userId: string,
    preferences: UserPreferences,
  ): Promise<UserPreferences> {
    await prisma.user.update({
      where: { id: userId },
      data: { preferences: preferences as Prisma.InputJsonValue },
    });
    return preferences;
  }
}

export const preferencesService = new PreferencesService();
