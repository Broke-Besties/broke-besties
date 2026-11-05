import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/services/email.service", async () => {
  const { createMockEmailService } = await import("../test/mocks");
  return { emailService: createMockEmailService() };
});

import { prisma } from "@/lib/prisma";
import { emailService } from "@/services/email.service";
import { friendService } from "@/services/friend.service";
import {
  BORROWER_ID,
  LENDER_ID,
  MockEmailService,
  MockPrisma,
  makeUser,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

const requester = makeUser({ id: LENDER_ID, name: "Req", email: "req@x.com" });
const recipient = makeUser({
  id: BORROWER_ID,
  name: "Rec",
  email: "rec@x.com",
});

describe("friendService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendFriendRequest", () => {
    it("validates recipient and self-requests", async () => {
      await expect(friendService.sendFriendRequest(LENDER_ID, "")).rejects.toThrow(
        "Recipient ID is required",
      );
      await expect(
        friendService.sendFriendRequest(LENDER_ID, LENDER_ID),
      ).rejects.toThrow("You cannot send a friend request to yourself");
    });

    it("throws when recipient does not exist", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        friendService.sendFriendRequest(LENDER_ID, BORROWER_ID),
      ).rejects.toThrow("User not found");
    });

    it("throws when already friends", async () => {
      db.user.findUnique.mockResolvedValueOnce(recipient);
      db.friend.findFirst.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "accepted",
      });

      await expect(
        friendService.sendFriendRequest(LENDER_ID, BORROWER_ID),
      ).rejects.toThrow("You are already friends with this user");
    });

    it("throws when a pending request already exists", async () => {
      db.user.findUnique.mockResolvedValueOnce(recipient);
      db.friend.findFirst.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "pending",
      });

      await expect(
        friendService.sendFriendRequest(LENDER_ID, BORROWER_ID),
      ).rejects.toThrow("Friend request already exists");
    });

    it("creates a new request and emails the recipient", async () => {
      db.user.findUnique.mockResolvedValueOnce(recipient);
      db.friend.findFirst.mockResolvedValueOnce(null);
      const created = {
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "pending",
        requester,
        recipient,
      };
      db.friend.create.mockResolvedValueOnce(created);

      const result = await friendService.sendFriendRequest(LENDER_ID, BORROWER_ID);

      expect(result.autoAccepted).toBe(false);
      expect(db.friend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { requesterId: LENDER_ID, recipientId: BORROWER_ID },
        }),
      );
      expect(email.sendFriendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ to: "rec@x.com" }),
      );
    });

    it("auto-accepts a reverse pending request and emails both users", async () => {
      db.user.findUnique.mockResolvedValueOnce(recipient);
      db.friend.findFirst.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "pending",
      });
      const updated = {
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "accepted",
        requester: recipient,
        recipient: requester,
      };
      db.friend.update.mockResolvedValueOnce(updated);

      const result = await friendService.sendFriendRequest(LENDER_ID, BORROWER_ID);

      expect(result.autoAccepted).toBe(true);
      expect(db.friend.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "accepted" } }),
      );
      expect(email.sendFriendRequestAccepted).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendFriendRequestByEmail", () => {
    it("requires an email and rejects adding yourself", async () => {
      await expect(
        friendService.sendFriendRequestByEmail(LENDER_ID, "  "),
      ).rejects.toThrow("Email is required");

      db.user.findUnique.mockResolvedValueOnce(
        makeUser({ id: LENDER_ID, email: "me@x.com" }),
      );
      await expect(
        friendService.sendFriendRequestByEmail(LENDER_ID, "me@x.com"),
      ).rejects.toThrow("You cannot send a friend request to yourself");
    });

    it("auto-accepts and emails a sign-up nudge for a not-signed-up user", async () => {
      const placeholder = makeUser({
        id: BORROWER_ID,
        email: "bob@x.com",
        name: "bob",
        signedUp: false,
      });
      db.user.findUnique.mockResolvedValueOnce(placeholder);
      db.friend.findFirst.mockResolvedValueOnce(null);
      const created = {
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "accepted",
        requester,
        recipient: placeholder,
      };
      db.friend.create.mockResolvedValueOnce(created);

      const result = await friendService.sendFriendRequestByEmail(
        LENDER_ID,
        "bob@x.com",
      );

      expect(result.autoAccepted).toBe(true);
      expect(result.notSignedUp).toBe(true);
      expect(db.friend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            requesterId: LENDER_ID,
            recipientId: BORROWER_ID,
            status: "accepted",
          },
        }),
      );
      expect(email.sendFriendSignupRequest).toHaveBeenCalledWith(
        expect.objectContaining({ to: "bob@x.com" }),
      );
      expect(email.sendFriendRequest).not.toHaveBeenCalled();
    });

    it("creates a placeholder when the email has no user yet", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);
      const placeholder = makeUser({
        id: "placeholder-id",
        email: "new@x.com",
        name: "new",
        signedUp: false,
      });
      db.user.create.mockResolvedValueOnce(placeholder);
      db.friend.findFirst.mockResolvedValueOnce(null);
      db.friend.create.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: "placeholder-id",
        status: "accepted",
        requester,
        recipient: placeholder,
      });

      await friendService.sendFriendRequestByEmail(LENDER_ID, "new@x.com");

      expect(db.user.create).toHaveBeenCalledWith({
        data: { email: "new@x.com", name: "new", signedUp: false },
      });
      expect(db.friend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            requesterId: LENDER_ID,
            recipientId: "placeholder-id",
            status: "accepted",
          },
        }),
      );
    });

    it("delegates to a normal request for a signed-up user", async () => {
      const existing = makeUser({ id: BORROWER_ID, email: "bob@x.com" });
      db.user.findUnique.mockResolvedValueOnce(existing);
      db.user.findUnique.mockResolvedValueOnce(existing);
      db.friend.findFirst.mockResolvedValueOnce(null);
      db.friend.create.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "pending",
        requester,
        recipient: existing,
      });

      const result = await friendService.sendFriendRequestByEmail(
        LENDER_ID,
        "bob@x.com",
      );

      expect(result.autoAccepted).toBe(false);
      expect(result.notSignedUp).toBe(false);
      expect(db.friend.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { requesterId: LENDER_ID, recipientId: BORROWER_ID },
        }),
      );
      expect(email.sendFriendRequest).toHaveBeenCalledWith(
        expect.objectContaining({ to: "bob@x.com" }),
      );
      expect(email.sendFriendSignupRequest).not.toHaveBeenCalled();
    });
  });

  describe("acceptFriendRequest", () => {
    it("throws when the request does not exist", async () => {
      db.friend.findUnique.mockResolvedValueOnce(null);

      await expect(friendService.acceptFriendRequest(1, LENDER_ID)).rejects.toThrow(
        "Friend request not found",
      );
    });

    it("throws when the user is not the recipient", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "pending",
      });

      await expect(friendService.acceptFriendRequest(1, BORROWER_ID)).rejects.toThrow(
        "You cannot accept this friend request",
      );
    });

    it("accepts and emails both users", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "pending",
      });
      const accepted = {
        id: 1,
        status: "accepted",
        requester,
        recipient,
      };
      db.friend.update.mockResolvedValueOnce(accepted);

      const result = await friendService.acceptFriendRequest(1, LENDER_ID);

      expect(result.status).toBe("accepted");
      expect(email.sendFriendRequestAccepted).toHaveBeenCalledTimes(2);
    });
  });

  describe("rejectFriendRequest", () => {
    it("emails the requester then deletes the request", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "pending",
        requester: recipient,
        recipient: requester,
      });

      const result = await friendService.rejectFriendRequest(1, LENDER_ID);

      expect(result.success).toBe(true);
      expect(email.sendFriendRequestRejected).toHaveBeenCalledTimes(1);
      expect(db.friend.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("rejects non-recipients", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        recipientId: LENDER_ID,
        status: "pending",
        requester: recipient,
        recipient: requester,
      });

      await expect(friendService.rejectFriendRequest(1, BORROWER_ID)).rejects.toThrow(
        "You cannot reject this friend request",
      );
      expect(db.friend.delete).not.toHaveBeenCalled();
    });
  });

  describe("cancelFriendRequest / removeFriend", () => {
    it("cancels a pending request as the requester", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "pending",
      });

      expect(await friendService.cancelFriendRequest(1, LENDER_ID)).toEqual({
        success: true,
      });
      expect(db.friend.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("removes an accepted friendship as either party", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "accepted",
      });

      expect(await friendService.removeFriend(1, BORROWER_ID)).toEqual({
        success: true,
      });
      expect(db.friend.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("blocks removing a pending friendship", async () => {
      db.friend.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        recipientId: BORROWER_ID,
        status: "pending",
      });

      await expect(friendService.removeFriend(1, BORROWER_ID)).rejects.toThrow(
        "You cannot remove this friendship",
      );
    });
  });

  describe("list helpers", () => {
    it("getFriends maps the other user", async () => {
      db.friend.findMany.mockResolvedValueOnce([
        {
          id: 1,
          requesterId: LENDER_ID,
          recipientId: BORROWER_ID,
          status: "accepted",
          requester,
          recipient,
        },
      ]);

      const friends = await friendService.getFriends(LENDER_ID);

      expect(friends[0].friend.id).toBe(BORROWER_ID);
    });

    it("areFriends returns true only for accepted rows either direction", async () => {
      db.friend.findFirst.mockResolvedValueOnce({ id: 1 });
      expect(await friendService.areFriends(LENDER_ID, BORROWER_ID)).toBe(true);

      db.friend.findFirst.mockResolvedValueOnce(null);
      expect(await friendService.areFriends(LENDER_ID, "u3")).toBe(false);
    });

    it("searchFriends returns [] for blank queries and filters by name/email", async () => {
      expect(await friendService.searchFriends(LENDER_ID, "   ")).toEqual([]);

      db.friend.findMany.mockResolvedValueOnce([
        {
          id: 1,
          requesterId: LENDER_ID,
          recipientId: BORROWER_ID,
          status: "accepted",
          requester,
          recipient,
        },
      ]);

      const hit = await friendService.searchFriends(LENDER_ID, "rec");
      expect(hit).toHaveLength(1);

      db.friend.findMany.mockResolvedValueOnce([
        {
          id: 1,
          requesterId: LENDER_ID,
          recipientId: BORROWER_ID,
          status: "accepted",
          requester,
          recipient,
        },
      ]);

      expect(await friendService.searchFriends(LENDER_ID, "zzz")).toHaveLength(0);
    });
  });
});
