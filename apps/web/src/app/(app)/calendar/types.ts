export type CalendarVisibility = "details" | "busy";

export type CalendarShare = {
  groupId: number;
  groupName: string;
  visibility: CalendarVisibility;
  allowRsvp: boolean;
  color: string;
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
  canRsvp: boolean;
  rsvp: "yes" | "no" | "pending" | null;
  color: string;
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
  color: string;
};

export type CalendarSettings = {
  timezone: string | null;
  personalColor: string;
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

export type ShareMode = "none" | "rsvp" | "view" | "busy";

export type ShareSelection = Record<number, ShareMode>;
