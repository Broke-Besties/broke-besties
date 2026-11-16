import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { FriendsList } from "./friends-list";
import { RequestsList } from "./requests-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Friend } from "./types";
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const me = { id: "me", name: "Me", email: "me@example.com" };
const other = {
  id: "alex",
  name: "A".repeat(100),
  email: `${"x".repeat(100)}@example.com`,
  signedUp: false,
};
const friend: Friend = {
  id: 1,
  requesterId: "alex",
  recipientId: "me",
  requester: other,
  recipient: me,
  friend: other,
  status: "accepted",
  createdAt: "2026-11-15",
};
describe("Friends rendered states", () => {
  it("renders compact semantic rows with invitation status and person-specific menus", () => {
    const html = renderToStaticMarkup(
      React.createElement(FriendsList, {
        friends: [friend, { ...friend, id: 2 }],
        pending: { id: 1, action: "remove" },
        onRemove: vi.fn(),
        onAddFriend: vi.fn(),
      }),
    );
    expect(html.match(/role="listitem"/g)).toHaveLength(2);
    expect(html.match(/data-slot="item-separator"/g)).toHaveLength(1);
    expect(html).toContain('role="list"');
    expect(html).toContain(`Actions for ${other.name}`);
    expect(html).toContain("Not signed up yet");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("locks all incoming and sent mutations while another row is pending", () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestsList, {
        pendingRequests: [friend, { ...friend, id: 2 }],
        sentRequests: [{ ...friend, recipient: other }],
        pending: { id: 1, action: "accept" },
        onAccept: vi.fn(),
        onReject: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(html.match(/disabled=""/g)).toHaveLength(5);
    expect(html).toContain("col-span-2 justify-end");
    expect(html).toContain("Needs your response");
    expect(html).toContain("Sent");
  });
  it("retains empty states and actions", () => {
    expect(
      renderToStaticMarkup(
        React.createElement(FriendsList, {
          friends: [],
          pending: null,
          onRemove: vi.fn(),
          onAddFriend: vi.fn(),
        }),
      ),
    ).toContain("Add a friend");
    const html = renderToStaticMarkup(
      React.createElement(RequestsList, {
        pendingRequests: [],
        sentRequests: [],
        pending: null,
        onAccept: vi.fn(),
        onReject: vi.fn(),
        onCancel: vi.fn(),
      }),
    );
    expect(html).toContain("No incoming requests");
    expect(html).toContain("No sent requests");
  });
  it("links Radix tabs to panels and preserves styling overrides", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Tabs,
        { defaultValue: "friends" },
        React.createElement(
          TabsList,
          { "aria-label": "Friends views", className: "w-full" },
          React.createElement(TabsTrigger, { value: "friends" }, "Friends"),
          React.createElement(TabsTrigger, { value: "requests" }, "Requests"),
        ),
        React.createElement(
          TabsContent,
          { value: "friends", className: "space-y-6" },
          "Friend list",
        ),
        React.createElement(TabsContent, { value: "requests" }, "Request list"),
      ),
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain("aria-controls=");
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("space-y-6");
    expect(html).toContain("w-full");
    expect(html).not.toContain("Request list");
  });
});
