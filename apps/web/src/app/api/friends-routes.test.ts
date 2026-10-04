import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/friend.service", () => ({
  friendService: {
    searchFriends: vi.fn(),
    getRecentFriends: vi.fn(),
    sendFriendRequest: vi.fn(),
  },
}));
vi.mock("@/services/user.service", () => ({
  userService: { searchUserByEmail: vi.fn() },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { friendService } from "@/services/friend.service";
import { userService } from "@/services/user.service";
import { POST as sendRequest } from "@/app/api/friends/route";
import { GET as searchFriends } from "@/app/api/friends/search/route";
import { GET as recentFriends } from "@/app/api/friends/recent/route";
import { BORROWER_ID, LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

function postFriend(body: unknown) {
  return new NextRequest("http://localhost/api/friends", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("friend routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("GET /api/friends/search", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await searchFriends(new NextRequest("http://localhost/api/friends/search?q=b"));

      expect(res.status).toBe(401);
      expect(friendService.searchFriends).not.toHaveBeenCalled();
    });

    it("searches with q, and with an empty query when q is missing", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);
      vi.mocked(friendService.searchFriends).mockResolvedValueOnce([{ id: 1 }] as never);

      let res = await searchFriends(new NextRequest("http://localhost/api/friends/search?q=bob"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ friends: [{ id: 1 }] });
      expect(friendService.searchFriends).toHaveBeenLastCalledWith(LENDER_ID, "bob");

      vi.mocked(friendService.searchFriends).mockResolvedValueOnce([]);
      res = await searchFriends(new NextRequest("http://localhost/api/friends/search"));
      expect(await res.json()).toEqual({ friends: [] });
      expect(friendService.searchFriends).toHaveBeenLastCalledWith(LENDER_ID, "");
    });

    it("hides unexpected errors behind a logged 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(friendService.searchFriends).mockRejectedValueOnce(new Error("db down"));

      const res = await searchFriends(new NextRequest("http://localhost/api/friends/search?q=b"));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("GET /api/friends/recent", () => {
    const req = (query = "") => new NextRequest(`http://localhost/api/friends/recent${query}`);

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await recentFriends(req());

      expect(res.status).toBe(401);
      expect(friendService.getRecentFriends).not.toHaveBeenCalled();
    });

    it.each([
      ["", 5],
      ["?limit=3", 3],
      ["?limit=0", 1],
      ["?limit=-4", 1],
      ["?limit=50", 20],
      ["?limit=abc", 5],
      ["?limit=", 5],
    ])("%j asks the service for %i friends", async (query, limit) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(friendService.getRecentFriends).mockResolvedValueOnce([{ id: 1 }] as never);

      const res = await recentFriends(req(query));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ friends: [{ id: 1 }] });
      expect(friendService.getRecentFriends).toHaveBeenCalledWith(LENDER_ID, limit);
    });

    it("hides unexpected errors behind a 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(friendService.getRecentFriends).mockRejectedValueOnce(new Error("db down"));

      const res = await recentFriends(req());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
    });
  });

  describe("POST /api/friends", () => {
    const friend = { id: 3, requesterId: LENDER_ID, recipientId: BORROWER_ID };

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await sendRequest(postFriend({ email: "bob@x.com" }));

      expect(res.status).toBe(401);
      expect(friendService.sendFriendRequest).not.toHaveBeenCalled();
    });

    it("still sends a request by recipientId", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(friendService.sendFriendRequest).mockResolvedValueOnce({
        friend,
        autoAccepted: false,
      } as never);

      const res = await sendRequest(postFriend({ recipientId: BORROWER_ID }));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        message: "Friend request sent successfully",
        friend,
        autoAccepted: false,
      });
      expect(friendService.sendFriendRequest).toHaveBeenCalledWith(LENDER_ID, BORROWER_ID);
      expect(userService.searchUserByEmail).not.toHaveBeenCalled();
    });

    it("looks the recipient up by trimmed, lowercased email", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.searchUserByEmail).mockResolvedValueOnce({
        id: BORROWER_ID,
        email: "bob@x.com",
      });
      vi.mocked(friendService.sendFriendRequest).mockResolvedValueOnce({
        friend,
        autoAccepted: true,
      } as never);

      const res = await sendRequest(postFriend({ email: "  Bob@X.com " }));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        message: "Friend request accepted! You are now friends.",
        friend,
        autoAccepted: true,
      });
      expect(userService.searchUserByEmail).toHaveBeenCalledWith("bob@x.com");
      expect(friendService.sendFriendRequest).toHaveBeenCalledWith(LENDER_ID, BORROWER_ID);
    });

    it("returns 404 when no user has that email", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.searchUserByEmail).mockRejectedValueOnce(new Error("User not found"));

      const res = await sendRequest(postFriend({ email: "nobody@x.com" }));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "User not found" });
      expect(friendService.sendFriendRequest).not.toHaveBeenCalled();
    });

    it.each([5, "   ", null])("rejects the email %j with 400", async (email) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await sendRequest(postFriend({ email }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Email is required" });
      expect(userService.searchUserByEmail).not.toHaveBeenCalled();
      expect(friendService.sendFriendRequest).not.toHaveBeenCalled();
    });

    it.each([
      ["Recipient ID is required", 400],
      ["You cannot send a friend request to yourself", 400],
      ["You are already friends with this user", 400],
      ["Friend request already exists", 400],
      ["User not found", 404],
    ])("keeps mapping the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.searchUserByEmail).mockResolvedValueOnce({
        id: LENDER_ID,
        email: "larry@x.com",
      });
      vi.mocked(friendService.sendFriendRequest).mockRejectedValueOnce(new Error(message));

      const res = await sendRequest(postFriend({ email: "larry@x.com" }));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });
  });
});
