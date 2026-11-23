import { prisma } from "@/lib/prisma";

export type CalendarVisibility = "owner" | "details" | "busy";

function strongestVisibility(
  rows: Array<{ visibility: string }>,
): CalendarVisibility | null {
  if (rows.some((row) => row.visibility === "details")) return "details";
  if (rows.length > 0) return "busy";
  return null;
}

export class CalendarPolicy {
  static isOwner(userId: string, event: { ownerId: string }): boolean {
    return event.ownerId === userId;
  }

  static async canView(userId: string, eventId: string): Promise<boolean> {
    return (await this.visibilityFor(userId, eventId)) !== null;
  }

  static async canEdit(userId: string, eventId: string): Promise<boolean> {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId },
      select: { ownerId: true },
    });
    return !!event && event.ownerId === userId;
  }

  static async canShare(userId: string, eventId: string): Promise<boolean> {
    return this.canEdit(userId, eventId);
  }

  /**
   * RSVPs are only available to people who can see the event's details. A
   * "busy" share hides the title and place, so there is nothing to RSVP to.
   */
  static async canRsvp(userId: string, eventId: string): Promise<boolean> {
    return (await this.visibilityFor(userId, eventId)) === "details";
  }

  static async canViewRsvps(
    userId: string,
    eventId: string,
  ): Promise<boolean> {
    const visibility = await this.visibilityFor(userId, eventId);
    return visibility === "owner" || visibility === "details";
  }

  static async isGroupMember(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: { userId, groupId },
      select: { id: true },
    });
    return !!membership;
  }

  /**
   * Resolves what a user may see for an event: owner, full details, busy
   * only, or nothing at all.
   */
  static async visibilityFor(
    userId: string,
    eventId: string,
  ): Promise<CalendarVisibility | null> {
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        OR: [
          { ownerId: userId },
          {
            shares: {
              some: { group: { members: { some: { userId } } } },
            },
          },
        ],
      },
      select: {
        ownerId: true,
        shares: {
          where: { group: { members: { some: { userId } } } },
          select: { visibility: true },
        },
      },
    });

    if (!event) return null;
    if (event.ownerId === userId) return "owner";
    return strongestVisibility(event.shares);
  }
}
