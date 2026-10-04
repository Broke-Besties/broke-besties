import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/dashboard-data", () => ({ getDashboardData: vi.fn() }));

import { getUser } from "@/lib/supabase";
import { getDashboardData } from "@/lib/dashboard-data";
import { GET } from "@/app/api/dashboard/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(getDashboardData).not.toHaveBeenCalled();
  });

  it("returns the shared dashboard data for the signed-in user", async () => {
    const data = { user: { id: LENDER_ID }, debts: [], counts: { invites: 1 } };
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(getDashboardData).mockResolvedValueOnce(data as never);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(data);
    expect(getDashboardData).toHaveBeenCalledWith(authUser);
  });

  it("hides unexpected errors behind a logged 500", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(getDashboardData).mockRejectedValueOnce(new Error("db down"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(console.error).toHaveBeenCalled();
  });
});
