import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/group.service", () => ({ groupService: { getGroupById: vi.fn() } }));
vi.mock("@/services/debt.service", () => ({ debtService: { getGroupDebts: vi.fn() } }));
vi.mock("@/services/invite.service", () => ({
  inviteService: { createInviteAsFriend: vi.fn() },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { groupService } from "@/services/group.service";
import { debtService } from "@/services/debt.service";
import { inviteService } from "@/services/invite.service";
import { GET as getGroup } from "@/app/api/groups/[id]/route";
import { GET as getGroupDebts } from "@/app/api/groups/[id]/debts/route";
import { POST as addMember } from "@/app/api/groups/[id]/members/route";
import { BORROWER_ID, LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postMember(body: unknown) {
  return new NextRequest("http://localhost/api/groups/7/members", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("group routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET /api/groups/[id]", () => {
    const req = () => new NextRequest("http://localhost/api/groups/7");

    it("returns the group", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(groupService.getGroupById).mockResolvedValueOnce({ id: 7 } as never);

      const res = await getGroup(req(), params("7"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ group: { id: 7 } });
      expect(groupService.getGroupById).toHaveBeenCalledWith(7, LENDER_ID);
    });

    it("maps the service's not-found-or-not-a-member error to 404", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(groupService.getGroupById).mockRejectedValueOnce(
        new Error("Group not found or you are not a member of this group"),
      );

      const res = await getGroup(req(), params("7"));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "Group not found or you are not a member of this group",
      });
    });
  });

  describe("GET /api/groups/[id]/debts", () => {
    const req = () => new NextRequest("http://localhost/api/groups/7/debts");

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await getGroupDebts(req(), params("7"));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
      expect(debtService.getGroupDebts).not.toHaveBeenCalled();
    });

    it.each(["abc", "7x", "2147483648"])("returns 400 for the invalid id %j", async (id) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await getGroupDebts(req(), params(id));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid group ID" });
      expect(debtService.getGroupDebts).not.toHaveBeenCalled();
    });

    it("lists the group's debts", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(debtService.getGroupDebts).mockResolvedValueOnce([{ id: 1 }] as never);

      const res = await getGroupDebts(req(), params("7"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ debts: [{ id: 1 }] });
      expect(debtService.getGroupDebts).toHaveBeenCalledWith(7, LENDER_ID);
    });

    it("maps a non-member to 403 and hides unexpected errors behind a 500", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);

      vi.mocked(debtService.getGroupDebts).mockRejectedValueOnce(
        new Error("You must be a member of the group to view its debts"),
      );
      let res = await getGroupDebts(req(), params("7"));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        error: "You must be a member of the group to view its debts",
      });

      vi.mocked(debtService.getGroupDebts).mockRejectedValueOnce(new Error("db down"));
      res = await getGroupDebts(req(), params("7"));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
    });
  });

  describe("POST /api/groups/[id]/members", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await addMember(postMember({ friendUserId: BORROWER_ID }), params("7"));

      expect(res.status).toBe(401);
      expect(inviteService.createInviteAsFriend).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-integer group id", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await addMember(postMember({ friendUserId: BORROWER_ID }), params("x"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid group ID" });
      expect(inviteService.createInviteAsFriend).not.toHaveBeenCalled();
    });

    it("adds the friend and returns 201 with the new member", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.createInviteAsFriend).mockResolvedValueOnce({
        id: 3,
        userId: BORROWER_ID,
      } as never);

      const res = await addMember(postMember({ friendUserId: BORROWER_ID }), params("7"));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ member: { id: 3, userId: BORROWER_ID } });
      expect(inviteService.createInviteAsFriend).toHaveBeenCalledWith(LENDER_ID, 7, BORROWER_ID);
    });

    it.each([
      ["Group ID and friend user ID are required", 400],
      ["You can only add friends directly to a group", 400],
      ["User is already a member of this group", 400],
      ["You are not a member of this group", 403],
      ["User not found", 404],
      ["db down", 500],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.createInviteAsFriend).mockRejectedValueOnce(new Error(message));

      const res = await addMember(postMember({ friendUserId: BORROWER_ID }), params("7"));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({
        error: status === 500 ? "Internal server error" : message,
      });
    });

    it.each([
      ["a numeric friendUserId", { friendUserId: 42 }],
      ["a missing friendUserId", {}],
    ])("rejects %s with the service's message", async (_label, body) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await addMember(postMember(body), params("7"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Group ID and friend user ID are required" });
      expect(inviteService.createInviteAsFriend).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed JSON body", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await addMember(postMember("{oops"), params("7"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });
      expect(inviteService.createInviteAsFriend).not.toHaveBeenCalled();
    });
  });
});
