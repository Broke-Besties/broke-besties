import {
  CreditCard,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavCounts = {
  debtRequests: number;
  invites: number;
  friendRequests: number;
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which NavCounts key surfaces as a badge on this item. */
  badge?: keyof NavCounts;
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Money",
    items: [
      { href: "/debts", label: "Debts", icon: CreditCard, badge: "debtRequests" },
      { href: "/recurring-payments", label: "Recurring", icon: RefreshCw },
      { href: "/tabs", label: "Tabs", icon: Receipt },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/groups", label: "Groups", icon: Users, badge: "invites" },
      { href: "/friends", label: "Friends", icon: UserPlus, badge: "friendRequests" },
    ],
  },
  {
    label: "Tools",
    items: [{ href: "/ai", label: "AI Assistant", icon: Sparkles }],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);
