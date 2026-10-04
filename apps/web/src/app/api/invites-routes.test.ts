import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/invite.service", () => ({
  inviteService: { rejectInvite: vi.fn(), cancelInvite: vi.fn() },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { inviteService } from "@/services/invite.service";
import { DELETE as cancelInvite } from "@/app/api/invites/[id]/route";
import { POST as rejectInvite } from "@/app/api/invites/[id]/reject/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("invite routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("POST /api/invites/[id]/reject", () => {
    const req = () =>
      new NextRequest("http://localhost/api/invites/5/reject", { method: "POST" });

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await rejectInvite(req(), params("5"));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
      expect(inviteService.rejectInvite).not.toHaveBeenCalled();
    });

    it.each(["abc", "1abc", "2147483648"])(
      "returns 400 for the invalid id %j",
      async (id) => {
        vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

        const res = await rejectInvite(req(), params(id));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Invalid invite ID" });
        expect(inviteService.rejectInvite).not.toHaveBeenCalled();
      },
    );

    it("rejects the invite addressed to the user's email", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.rejectInvite).mockResolvedValueOnce({ success: true });

      const res = await rejectInvite(req(), params("5"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Invite rejected" });
      expect(inviteService.rejectInvite).toHaveBeenCalledWith("larry@x.com", 5);
    });

    it.each([undefined, ""])(
      "returns 403 for a session without an email (%j)",
      async (email) => {
        vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID, email } as never);

        const res = await rejectInvite(req(), params("5"));

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({
          error: "You can only reject invites sent to you",
        });
        expect(inviteService.rejectInvite).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["Invite not found", 404],
      ["You can only reject invites sent to you", 403],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.rejectInvite).mockRejectedValueOnce(new Error(message));

      const res = await rejectInvite(req(), params("5"));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });

    it("hides unexpected errors behind a logged 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.rejectInvite).mockRejectedValueOnce(new Error("db down"));

      const res = await rejectInvite(req(), params("5"));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/invites/[id]", () => {
    const req = () =>
      new NextRequest("http://localhost/api/invites/5", { method: "DELETE" });

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await cancelInvite(req(), params("5"));

      expect(res.status).toBe(401);
      expect(inviteService.cancelInvite).not.toHaveBeenCalled();
    });

    it.each(["-3", "2147483648"])(
      "returns 400 for the invalid id %j",
      async (id) => {
        vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

        const res = await cancelInvite(req(), params(id));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Invalid invite ID" });
        expect(inviteService.cancelInvite).not.toHaveBeenCalled();
      },
    );

    it("cancels an invite the user sent", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.cancelInvite).mockResolvedValueOnce({ success: true });

      const res = await cancelInvite(req(), params("5"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Invite cancelled" });
      expect(inviteService.cancelInvite).toHaveBeenCalledWith(LENDER_ID, 5);
    });

    it.each([
      ["Invite not found", 404],
      ["You can only cancel invites you sent", 403],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.cancelInvite).mockRejectedValueOnce(new Error(message));

      const res = await cancelInvite(req(), params("5"));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });

    it("hides unexpected errors behind a 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(inviteService.cancelInvite).mockRejectedValueOnce(new Error("db down"));

      const res = await cancelInvite(req(), params("5"));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
    });
  });
});
