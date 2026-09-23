import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import { groupService } from "@/services/group.service";
import { LENDER_ID, MockPrisma, makeUser } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

describe("groupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGroup", () => {
    it("requires a name", async () => {
      await expect(groupService.createGroup(LENDER_ID, "")).rejects.toThrow(
        "Group name is required",
      );
      expect(db.group.create).not.toHaveBeenCalled();
    });

    it("creates the group with the creator as initial member", async () => {
      const created = {
        id: 1,
        name: "Roommates",
        members: [{ userId: LENDER_ID, user: makeUser() }],
      };
      db.group.create.mockResolvedValueOnce(created);

      const group = await groupService.createGroup(LENDER_ID, "Roommates");

      expect(group).toEqual(created);
      expect(db.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: "Roommates",
            members: { create: { userId: LENDER_ID } },
          },
        }),
      );
    });
  });

  describe("getUserGroups", () => {
    it("scopes to groups where the user is a member", async () => {
      db.group.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const groups = await groupService.getUserGroups(LENDER_ID);

      expect(groups).toHaveLength(2);
      expect(db.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: LENDER_ID } } },
        }),
      );
    });
  });

  describe("getGroupById", () => {
    it("throws when group is missing or user is not a member", async () => {
      db.group.findFirst.mockResolvedValueOnce(null);

      await expect(groupService.getGroupById(999, LENDER_ID)).rejects.toThrow(
        "Group not found or you are not a member of this group",
      );
    });

    it("returns the group for members", async () => {
      const group = { id: 1, name: "Roommates", members: [], invites: [] };
      db.group.findFirst.mockResolvedValueOnce(group);

      const result = await groupService.getGroupById(1, LENDER_ID);

      expect(result).toEqual(group);
      expect(db.group.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 1,
            members: { some: { userId: LENDER_ID } },
          },
        }),
      );
    });
  });

  describe("searchGroupMembers", () => {
    it("rejects non-members", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce(null);

      await expect(
        groupService.searchGroupMembers(1, LENDER_ID, "bob"),
      ).rejects.toThrow("You are not a member of this group");
      expect(db.groupMember.findMany).not.toHaveBeenCalled();
    });

    it("returns matched member users, capped at 10", async () => {
      db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
      const members = Array.from({ length: 12 }, (_, i) => ({
        user: { id: `u${i}`, name: `User ${i}`, email: `u${i}@x.com` },
      }));
      db.groupMember.findMany.mockResolvedValueOnce(members.slice(0, 10));

      const users = await groupService.searchGroupMembers(1, LENDER_ID, "user");

      expect(users).toHaveLength(10);
      expect(db.groupMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
