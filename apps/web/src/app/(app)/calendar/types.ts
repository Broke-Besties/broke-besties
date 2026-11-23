export type CalendarVisibility = "details" | "busy";

export type CalendarShare = {
  groupId: number;
  groupName: string;
  visibility: CalendarVisibility;
};

export type CalendarEventView = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  busy: boolean;
  status: string;
  source: string;
  owner: { id: string; name: string; email: string };
  isOwner: boolean;
  visibility: "owner" | CalendarVisibility;
  rsvp: "yes" | "no" | "pending" | null;
  shares: CalendarShare[];
  rsvps?: Array<{
    userId: string;
    name: string;
    email: string;
    response: "yes" | "no" | "pending";
  }>;
  invitees?: Array<{
    userId: string;
    name: string;
    email: string;
    response: "yes" | "no" | "pending";
  }>;
  createdAt: string;
  updatedAt: string;
};

export type CalendarGroup = {
  id: number;
  name: string;
  memberCount: number;
};

export type CalendarSubscriptionView = {
  id: number;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShareSelection = Record<number, CalendarVisibility | "none">;
