import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/services/email.service", async () => {
  const { createMockEmailService } = await import("../test/mocks");
  return { emailService: createMockEmailService() };
});
vi.mock("@/services/friend.service", async () => {
  return { friendService: { areFriends: vi.fn() } };
});

import { prisma } from "@/lib/prisma";
import { friendService } from "@/services/friend.service";
import { emailService } from "@/services/email.service";
import { inviteService } from "@/services/invite.service";
import {
  BORROWER_ID,
  LENDER_ID,
  MockEmailService,
  MockPrisma,
  makeUser,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

describe("inviteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInvite", () => {
    it("requires groupId and email", async () => {
      await expect(inviteService.createInvite(LENDER_ID, 0, "")).rejects.toThrow(
        "Group ID and invited email are required",
      );
    });

    it("enforces membership, duplicate invite and existing member rules", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce(null);
      await expect(
        inviteService.createInvite(LENDER_ID, 1, "a@x.com"),
      ).rejects.toThrow("You are not a member of this group");

      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      db.groupInvite.findUnique.mockResolvedValueOnce({ id: 1 });
      await expect(
        inviteService.createInvite(LENDER_ID, 1, "a@x.com"),
      ).rejects.toThrow("Invite already exists for this email");

      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      db.groupInvite.findUnique.mockResolvedValueOnce(null);
      db.user.findUnique.mockResolvedValueOnce({ members: [{ id: 1 }] });
      await expect(
        inviteService.createInvite(LENDER_ID, 1, "a@x.com"),
      ).rejects.toThrow("User is already a member of this group");
    });

    it("creates the invite and emails the invitee", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      db.groupInvite.findUnique.mockResolvedValueOnce(null);
      db.user.findUnique.mockResolvedValueOnce({ members: [] });
      const created = {
        id: 1,
        groupId: 1,
        invitedEmail: "a@x.com",
        group: { id: 1, name: "Roommates" },
        sender: { name: "Larry" },
      };
      db.groupInvite.create.mockResolvedValueOnce(created);

      const invite = await inviteService.createInvite(LENDER_ID, 1, "a@x.com");

      expect(invite).toEqual(created);
      expect(email.sendGroupInvite).toHaveBeenCalledWith(
        expect.objectContaining({ to: "a@x.com", groupName: "Roommates" }),
      );
    });
  });

  describe("createInviteAsFriend", () => {
    it("requires actual friendship and non-membership", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      vi.mocked(friendService.areFriends).mockResolvedValueOnce(false);
      await expect(
        inviteService.createInviteAsFriend(LENDER_ID, 1, BORROWER_ID),
      ).rejects.toThrow("You can only add friends directly to a group");

      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      vi.mocked(friendService.areFriends).mockResolvedValueOnce(true);
      db.user.findUnique.mockResolvedValueOnce(
        makeUser({ id: BORROWER_ID, email: "b@x.com", members: [] }),
      );
      db.user.findUnique.mockResolvedValueOnce({
        ...makeUser({ id: BORROWER_ID, email: "b@x.com" }),
        members: [{ id: 1 }],
      });
      await expect(
        inviteService.createInviteAsFriend(LENDER_ID, 1, BORROWER_ID),
      ).rejects.toThrow("User is already a member of this group");
    });

    it("adds the friend as a member directly", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      vi.mocked(friendService.areFriends).mockResolvedValueOnce(true);
      db.user.findUnique.mockResolvedValueOnce(
        makeUser({ id: BORROWER_ID, email: "b@x.com" }),
      );
      db.user.findUnique.mockResolvedValueOnce({ ...makeUser({ id: BORROWER_ID }), members: [] });
      const member = { id: 1, userId: BORROWER_ID, groupId: 1 };
      db.groupMember.create.mockResolvedValueOnce(member);

      const result = await inviteService.createInviteAsFriend(
        LENDER_ID,
        1,
        BORROWER_ID,
      );

      expect(result).toEqual(member);
      expect(db.groupMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: BORROWER_ID, groupId: 1 } }),
      );
    });
  });

  describe("acceptInvite", () => {
    it("throws differentiated errors for missing / foreign / processed invites", async () => {
      db.groupInvite.findUnique.mockResolvedValueOnce(null);
      await expect(
        inviteService.acceptInvite(LENDER_ID, "a@x.com", 1),
      ).rejects.toThrow("Invite not found");

      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        invitedEmail: "b@x.com",
        status: "pending",
      });
      await expect(
        inviteService.acceptInvite(LENDER_ID, "a@x.com", 1),
      ).rejects.toThrow("This invite is not for you");

      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        invitedEmail: "a@x.com",
        status: "accepted",
      });
      await expect(
        inviteService.acceptInvite(LENDER_ID, "a@x.com", 1),
      ).rejects.toThrow("This invite has already been processed");
    });

    it("adds the user to the group and marks the invite accepted in a transaction", async () => {
      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        groupId: 1,
        invitedEmail: "a@x.com",
        status: "pending",
      });
      const member = {
        userId: LENDER_ID,
        group: { id: 1, name: "Roommates" },
        user: { name: "Larry" },
      };
      const updatedInvite = { status: "accepted", sender: { email: "s@x.com", name: "S" } };
      db.groupMember.create.mockResolvedValueOnce(member);
      db.groupInvite.update.mockResolvedValueOnce(updatedInvite);

      const group = await inviteService.acceptInvite(LENDER_ID, "a@x.com", 1);

      expect(group).toEqual(member.group);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(db.groupMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: LENDER_ID, groupId: 1 } }),
      );
      expect(db.groupInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "accepted" } }),
      );
      expect(email.sendGroupInviteAccepted).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelInvite / rejectInvite", () => {
    it("cancels only as the sender of a pending invite", async () => {
      db.groupInvite.findUnique.mockResolvedValueOnce({ id: 1, invitedBy: "u9", status: "pending" });
      await expect(inviteService.cancelInvite(LENDER_ID, 1)).rejects.toThrow(
        "You can only cancel invites you sent",
      );

      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        invitedBy: LENDER_ID,
        status: "pending",
      });
      expect(await inviteService.cancelInvite(LENDER_ID, 1)).toEqual({ success: true });
      expect(db.groupInvite.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("rejects only as the recipient and emails the sender", async () => {
      db.groupInvite.findUnique.mockResolvedValueOnce({ id: 1, invitedEmail: "b@x.com", status: "pending" });
      await expect(inviteService.rejectInvite("a@x.com", 1)).rejects.toThrow(
        "You can only reject invites sent to you",
      );

      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        invitedEmail: "a@x.com",
        status: "pending",
        sender: { email: "s@x.com", name: "S" },
        group: { name: "Roommates" },
      });
      db.user.findUnique.mockResolvedValueOnce(makeUser({ email: "a@x.com", name: "A" }));

      expect(await inviteService.rejectInvite("a@x.com", 1)).toEqual({ success: true });
      expect(db.groupInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "rejected" } }),
      );
      expect(email.sendGroupInviteRejected).toHaveBeenCalledTimes(1);
    });

    it("skips the sender email when the rejector has no user row", async () => {
      db.groupInvite.findUnique.mockResolvedValueOnce({
        id: 1,
        invitedEmail: "a@x.com",
        status: "pending",
        sender: { email: "s@x.com", name: "S" },
        group: { name: "Roommates" },
      });
      db.user.findUnique.mockResolvedValueOnce(null);

      await inviteService.rejectInvite("a@x.com", 1);

      expect(email.sendGroupInviteRejected).not.toHaveBeenCalled();
    });
  });
});
