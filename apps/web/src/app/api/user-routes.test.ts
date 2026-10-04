import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/user.service", () => ({
  userService: { deleteAccount: vi.fn() },
}));

import { getUser } from "@/lib/supabase";
import { userService } from "@/services/user.service";
import { DELETE as deleteUserRoute } from "@/app/api/user/route";
import { LENDER_ID } from "../../test/mocks";

describe("DELETE /api/user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await deleteUserRoute();

    expect(res.status).toBe(401);
    expect(userService.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the current user's account", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID } as never);
    vi.mocked(userService.deleteAccount).mockResolvedValueOnce(undefined);

    const res = await deleteUserRoute();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Account deleted" });
    expect(userService.deleteAccount).toHaveBeenCalledWith(LENDER_ID);
  });

  it("returns 500 with the message when deletion fails", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID } as never);
    vi.mocked(userService.deleteAccount).mockRejectedValueOnce(
      new Error("Database error deleting user"),
    );

    const res = await deleteUserRoute();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Database error deleting user" });
  });
});
