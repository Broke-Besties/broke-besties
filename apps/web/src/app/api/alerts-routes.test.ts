import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/alert.service", () => ({
  alertService: {
    getActiveAlertsForBorrower: vi.fn(),
    getActiveAlertsForLender: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";
import { GET } from "@/app/api/alerts/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

describe("GET /api/alerts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await GET(new NextRequest("http://localhost/api/alerts"));

    expect(res.status).toBe(401);
    expect(alertService.getActiveAlertsForBorrower).not.toHaveBeenCalled();
  });

  it("returns the alerts the user created with ?role=lender", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(alertService.getActiveAlertsForLender).mockResolvedValueOnce([{ id: 1 }] as never);

    const res = await GET(new NextRequest("http://localhost/api/alerts?role=lender"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alerts: [{ id: 1 }] });
    expect(alertService.getActiveAlertsForLender).toHaveBeenCalledWith(LENDER_ID);
    expect(alertService.getActiveAlertsForBorrower).not.toHaveBeenCalled();
  });

  it.each(["", "?role=borrower", "?role=LENDER"])(
    "returns the alerts targeting the user for %j",
    async (query) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(alertService.getActiveAlertsForBorrower).mockResolvedValueOnce([
        { id: 2 },
      ] as never);

      const res = await GET(new NextRequest(`http://localhost/api/alerts${query}`));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ alerts: [{ id: 2 }] });
      expect(alertService.getActiveAlertsForBorrower).toHaveBeenCalledWith(LENDER_ID);
      expect(alertService.getActiveAlertsForLender).not.toHaveBeenCalled();
    },
  );
});
