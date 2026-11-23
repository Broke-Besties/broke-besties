import * as React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import FriendsPageClient from "./friends-client";
import { AddFriendDialog } from "./add-friend-dialog";
import { FriendsList } from "./friends-list";
import { RequestsList } from "./requests-list";
import { acceptFriendRequest, sendFriendRequestByEmail } from "./actions";
import type { Friend } from "./types";

const navigation = vi.hoisted(() => ({ query: "", replaceState: vi.fn() }));
const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.values)) hooks.values[i] = initial;
    return [
      hooks.values[i],
      (value: unknown) => {
        hooks.values[i] =
          typeof value === "function" ? value(hooks.values[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = hooks.index++;
    return (hooks.values[i] ??= { current: initial });
  },
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/friends",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./actions", () => ({
  acceptFriendRequest: vi.fn(),
  sendFriendRequestByEmail: vi.fn(),
  rejectFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  cancelFriendRequest: vi.fn(),
}));
vi.stubGlobal("React", React);
vi.stubGlobal("window", { history: { replaceState: navigation.replaceState } });
afterAll(() => vi.unstubAllGlobals());
const dates = {
  createdAt: new Date("2026-11-15"),
  updatedAt: new Date("2026-11-15"),
  premium: false,
  signedUp: true,
  preferences: null,
};
const me = { ...dates, id: "me", name: "Me", email: "me@example.com" };
const other = {
  ...dates,
  id: "other",
  name: "Alex",
  email: "alex@example.com",
};
const request = {
  updatedAt: dates.updatedAt,
  id: 1,
  requesterId: other.id,
  recipientId: me.id,
  requester: other,
  recipient: me,
  status: "pending",
  createdAt: dates.createdAt,
};
const existing: Friend = { ...request, id: 2, friend: other };
function find<P>(
  tree: React.ReactNode,
  type: React.ComponentType<P> | string,
): P {
  for (const node of React.Children.toArray(tree)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) continue;
    if (node.type === type) return node.props as P;
    if (node.props.children) {
      const result = find(node.props.children, type);
      if (result) return result;
    }
  }
  return undefined as P;
}
function render(friends = [existing]) {
  hooks.index = 0;
  return FriendsPageClient({
    currentUserId: me.id,
    initialFriends: friends,
    initialPendingRequests: [request],
    initialSentRequests: [],
  });
}
beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  vi.clearAllMocks();
  navigation.query = "";
});
describe("friendship reconciliation with isolated actions", () => {
  it("removes reciprocal incoming requests and prepends without duplicate IDs", async () => {
    vi.mocked(sendFriendRequestByEmail).mockResolvedValue({
      success: true,
      autoAccepted: true,
      notSignedUp: false,
      friend: { ...request, status: "accepted" },
    });
    await find(render(), AddFriendDialog).onSubmit(other.email);
    expect(find(render(), RequestsList).pendingRequests).toEqual([]);
    expect(find(render(), FriendsList).friends.map((f) => f.id)).toEqual([
      1, 2,
    ]);
    expect(find(render(), FriendsList).friends[0].friend).toEqual(other);
    await find(render(), AddFriendDialog).onSubmit(other.email);
    expect(find(render(), FriendsList).friends.map((f) => f.id)).toEqual([
      1, 2,
    ]);
  });
  it("blocks overlapping requests before a render and prepends accepted friends", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof acceptFriendRequest>>,
    ) => void;
    vi.mocked(acceptFriendRequest).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const props = find(render(), RequestsList);
    const first = props.onAccept(1);
    const second = props.onAccept(1);
    expect(acceptFriendRequest).toHaveBeenCalledTimes(1);
    resolve({ success: true, friend: { ...request, status: "accepted" } });
    await Promise.all([first, second]);
    expect(find(render(), FriendsList).friends.map((f) => f.id)).toEqual([
      1, 2,
    ]);
    expect(find(render(), RequestsList).pendingRequests).toEqual([]);
  });
  it("uses the recipient identity for invitations without an account", async () => {
    const invited = { ...other, signedUp: false };
    vi.mocked(sendFriendRequestByEmail).mockResolvedValue({
      success: true,
      autoAccepted: true,
      notSignedUp: true,
      friend: {
        ...request,
        requesterId: me.id,
        requester: me,
        recipientId: invited.id,
        recipient: invited,
      },
    });
    await find(render(), AddFriendDialog).onSubmit(invited.email);
    expect(find(render(), FriendsList).friends[0].friend).toEqual(invited);
  });
  it("returns inline errors and permits retry", async () => {
    vi.mocked(sendFriendRequestByEmail)
      .mockResolvedValueOnce({ success: false, error: "Try again" })
      .mockResolvedValueOnce({
        success: true,
        friend: {
          ...request,
          requester: me,
          recipient: other,
          requesterId: me.id,
          recipientId: other.id,
        },
        autoAccepted: false,
        notSignedUp: false,
      });
    expect(await find(render(), AddFriendDialog).onSubmit(other.email)).toEqual(
      { success: false, error: "Try again" },
    );
    expect(await find(render(), AddFriendDialog).onSubmit(other.email)).toEqual(
      { success: true },
    );
    expect(find(render(), RequestsList).sentRequests).toHaveLength(1);
  });
});

describe("add friend dialog lifecycle", () => {
  it("retains failures, locks delayed submissions and resets after success", async () => {
    const { Input } = await import("@/components/ui/input");
    const { Dialog, DialogContent } = await import("@/components/ui/dialog");
    const { FieldError } = await import("@/components/ui/field");
    const onOpenChange = vi.fn();
    let resolve!: (
      result: { success: true } | { success: false; error: string },
    ) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<{ success: true } | { success: false; error: string }>(
          (done) => {
            resolve = done;
          },
        ),
    );
    const renderDialog = () => {
      hooks.index = 0;
      return AddFriendDialog({ open: true, onOpenChange, onSubmit });
    };
    find(renderDialog(), Input).onChange!({
      target: { value: "alex@example.com" },
    } as React.ChangeEvent<HTMLInputElement>);
    const submit = find<React.ComponentProps<"form">>(
      renderDialog(),
      "form",
    ).onSubmit!;
    const event = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;
    const first = submit(event);
    const second = submit(event);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(find(renderDialog(), Input).disabled).toBe(true);
    expect(find(renderDialog(), DialogContent).showCloseButton).toBe(false);
    find(renderDialog(), Dialog).onOpenChange!(false);
    expect(onOpenChange).not.toHaveBeenCalled();
    const preventDefault = vi.fn();
    find(renderDialog(), DialogContent).onEscapeKeyDown!({
      preventDefault,
    } as unknown as KeyboardEvent);
    find(renderDialog(), DialogContent).onInteractOutside!({
      preventDefault,
    } as never);
    expect(preventDefault).toHaveBeenCalledTimes(2);
    resolve({ success: false, error: "Server unavailable" });
    await Promise.all([first, second]);
    expect(find(renderDialog(), Input).value).toBe("alex@example.com");
    expect(find(renderDialog(), FieldError).children).toBe(
      "Server unavailable",
    );
    const retry = find<React.ComponentProps<"form">>(renderDialog(), "form")
      .onSubmit!(event);
    resolve({ success: true });
    await retry;
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(find(renderDialog(), Input).value).toBe("");
  });
  it("resets the email after deliberate dismissal", async () => {
    const { Input } = await import("@/components/ui/input");
    const { Dialog } = await import("@/components/ui/dialog");
    const renderDialog = () => {
      hooks.index = 0;
      return AddFriendDialog({
        open: true,
        onOpenChange: vi.fn(),
        onSubmit: vi.fn(),
      });
    };
    find(renderDialog(), Input).onChange!({
      target: { value: "alex@example.com" },
    } as React.ChangeEvent<HTMLInputElement>);
    find(renderDialog(), Dialog).onOpenChange!(false);
    expect(find(renderDialog(), Input).value).toBe("");
  });
});

describe("Friends URL navigation", () => {
  it("preserves unrelated parameters when switching tabs and dismissing deep links", async () => {
    const { Tabs } = await import("@/components/ui/tabs");
    navigation.query = "tab=requests&new=1&source=dashboard";
    expect(find(render(), Tabs).value).toBe("requests");
    find(render(), Tabs).onValueChange!("friends");
    expect(navigation.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/friends?new=1&source=dashboard",
    );
    find(render(), AddFriendDialog).onOpenChange(false);
    expect(navigation.replaceState).toHaveBeenLastCalledWith(
      null,
      "",
      "/friends?tab=requests&source=dashboard",
    );
  });
  it("restores focus to the header when the original opener is unavailable", async () => {
    const { Button } = await import("@/components/ui/button");
    const tree = render();
    const focus = vi.fn();
    const { PageHeader } = await import("@/components/page-header");
    const ref = find(find(tree, PageHeader).actions, Button)
      .ref as React.RefObject<{
      focus: () => void;
    } | null>;
    ref.current = { focus };
    const preventDefault = vi.fn();
    find(tree, AddFriendDialog).onCloseAutoFocus!({
      preventDefault,
    } as unknown as Event);
    expect(preventDefault).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
