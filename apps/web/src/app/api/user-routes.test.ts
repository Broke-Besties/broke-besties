import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/user.service", () => ({
  userService: { deleteAccount: vi.fn(), updateUser: vi.fn() },
}));

import { getUser } from "@/lib/supabase";
import { userService } from "@/services/user.service";
import {
  DELETE as deleteUserRoute,
  PATCH as patchUserRoute,
} from "@/app/api/user/route";
import { LENDER_ID } from "../../test/mocks";

describe("PATCH /api/user", () => {
  const patch = (body: string) =>
    patchUserRoute(
      new Request("http://localhost/api/user", {
        method: "PATCH",
        body,
        headers: { "content-type": "application/json" },
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUser).mockResolvedValue({ id: LENDER_ID } as never);
  });

  it("returns 400 instead of 500 for malformed JSON or a non-string name", async () => {
    for (const body of ["{oops", "null", JSON.stringify({ name: 5 }), JSON.stringify({ name: "  " })]) {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Name is required" });
    }
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it("saves the trimmed name", async () => {
    vi.mocked(userService.updateUser).mockResolvedValueOnce({ id: LENDER_ID, name: "Ada" } as never);

    const res = await patch(JSON.stringify({ name: "  Ada " }));

    expect(res.status).toBe(200);
    expect(userService.updateUser).toHaveBeenCalledWith(LENDER_ID, { name: "Ada" });
  });
});

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
