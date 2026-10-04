import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/nav-counts", () => ({ getNavCounts: vi.fn() }));

import { getUser } from "@/lib/supabase";
import { getNavCounts } from "@/lib/nav-counts";
import { GET } from "@/app/api/me/counts/route";
import { LENDER_ID } from "../../test/mocks";

const counts = { debtRequests: 2, invites: 1, friendRequests: 0 };

describe("GET /api/me/counts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(getNavCounts).not.toHaveBeenCalled();
  });

  it("returns the badge counts unwrapped", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID, email: "larry@x.com" } as never);
    vi.mocked(getNavCounts).mockResolvedValueOnce(counts);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(counts);
    expect(getNavCounts).toHaveBeenCalledWith(LENDER_ID, "larry@x.com");
  });

  it("counts with an empty email when the session has none", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID } as never);
    vi.mocked(getNavCounts).mockResolvedValueOnce(counts);

    await GET();

    expect(getNavCounts).toHaveBeenCalledWith(LENDER_ID, "");
  });

  it("hides unexpected errors behind a logged 500", async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: LENDER_ID } as never);
    vi.mocked(getNavCounts).mockRejectedValueOnce(new Error("db down"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(console.error).toHaveBeenCalled();
  });
});
