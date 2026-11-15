import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsDropdown } from "./notifications-dropdown";

const { refresh, effects, opened } = vi.hoisted(() => ({
  refresh: vi.fn(),
  effects: [] as (() => (() => void) | void)[],
  opened: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useEffect: (effect: () => (() => void) | void) => effects.push(effect),
}));
// Render the portalled menu inline so its real links and labels can be checked.
vi.mock("@/components/ui/dropdown-menu", () => {
  const children = ({ children }: { children: React.ReactNode }) => children;
  return {
    DropdownMenu: ({
      children: content,
      onOpenChange,
    }: {
      children: React.ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => {
      opened.mockImplementation(onOpenChange);
      return content;
    },
    DropdownMenuContent: children,
    DropdownMenuTrigger: children,
    DropdownMenuItem: children,
    DropdownMenuGroup: children,
    DropdownMenuLabel: children,
    DropdownMenuSeparator: () => null,
  };
});
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
afterEach(() => {
  effects.length = 0;
  refresh.mockClear();
  vi.useRealTimers();
});

const props = {
  alerts: [],
  pendingTransactions: [],
  friendRequests: 0,
  groupInvites: 0,
};

describe("notification menu", () => {
  it("counts invitations and links directly to the specific request", () => {
    const html = renderToStaticMarkup(
      React.createElement(NotificationsDropdown, {
        ...props,
        friendRequests: 2,
        groupInvites: 1,
        pendingTransactions: [
          {
            id: -7,
            type: "modify",
            status: "pending",
            proposedAmount: 0,
            proposedDescription: null,
            reason: null,
            createdAt: "2026-11-14",
            requester: {
              id: "friend",
              name: "Alex",
              email: "alex@example.com",
            },
            debt: {
              id: -8,
              amount: 20,
              description: "Dinner",
              lender: { id: "me" },
              borrower: {
                id: "friend",
                name: "Alex",
                email: "alex@example.com",
              },
            },
          },
        ],
      }),
    );
    expect(html).toContain("Notifications (4 need attention)");
    expect(html).toContain('href="/debts/-8/requests/-7"');
    expect(html).toContain('href="/friends?tab=requests"');
    expect(html).toContain('href="/invites"');
    expect(html).toContain("$0.00");
  });

  it("refreshes on opening, focus and visible polling, then cleans up", () => {
    vi.useFakeTimers();
    const windowTarget = new EventTarget();
    const documentState = { visibilityState: "visible" };
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentState);
    try {
      renderToStaticMarkup(React.createElement(NotificationsDropdown, props));
      const cleanup = effects[0]();
      opened(true);
      expect(refresh).toHaveBeenCalledTimes(1);
      windowTarget.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(30_000);
      expect(refresh).toHaveBeenCalledTimes(3);
      documentState.visibilityState = "hidden";
      vi.advanceTimersByTime(30_000);
      expect(refresh).toHaveBeenCalledTimes(3);
      cleanup?.();
      documentState.visibilityState = "visible";
      windowTarget.dispatchEvent(new Event("focus"));
      vi.advanceTimersByTime(30_000);
      expect(refresh).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal("React", React);
    }
  });
});
