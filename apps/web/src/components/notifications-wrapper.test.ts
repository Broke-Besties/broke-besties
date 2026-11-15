import * as React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { NotificationsWrapper } from "./notifications-wrapper";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/alert.service", () => ({
  alertService: { getActiveAlertsForBorrower: vi.fn() },
}));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: { getUserPendingTransactions: vi.fn() },
}));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

describe("notification data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes approvals for either role and only unpaid overdue debts", async () => {
    vi.mocked(getUser).mockResolvedValue({ id: "me" } as Awaited<
      ReturnType<typeof getUser>
    >);
    const request = (
      id: number,
      lenderId: string,
      borrowerId: string,
      lenderApproved: boolean,
      borrowerApproved: boolean,
    ) => ({
      id,
      status: "pending",
      lenderApproved,
      borrowerApproved,
      debt: { lenderId, borrowerId },
    });
    vi.mocked(
      debtTransactionService.getUserPendingTransactions,
    ).mockResolvedValue([
      request(1, "me", "friend", false, true),
      request(2, "friend", "me", true, false),
      request(3, "friend", "me", false, true),
      request(4, "other", "friend", false, false),
    ] as Awaited<
      ReturnType<typeof debtTransactionService.getUserPendingTransactions>
    >);
    const alert = (
      id: number,
      deadline: Date | null,
      status = "pending",
      isActive = true,
    ) => ({
      id,
      deadline,
      isActive,
      debt: { id, status },
    });
    vi.mocked(alertService.getActiveAlertsForBorrower).mockResolvedValue([
      alert(1, new Date(0)),
      alert(2, new Date("2099-01-01")),
      alert(3, null),
      alert(4, new Date(0), "paid"),
      alert(5, new Date(0), "pending", false),
      { id: 6, deadline: new Date(0), isActive: true, debt: null },
    ] as Awaited<ReturnType<typeof alertService.getActiveAlertsForBorrower>>);

    const result = await NotificationsWrapper({
      counts: { friendRequests: 2, invites: 1, debtRequests: 2 },
    });
    expect(result?.props.friendRequests).toBe(2);
    expect(result?.props.groupInvites).toBe(1);
    expect(
      result?.props.pendingTransactions.map((t: { id: number }) => t.id),
    ).toEqual([1, 2]);
    expect(result?.props.alerts.map((a: { id: number }) => a.id)).toEqual([1]);
  });

  it("does not fetch notifications for a guest", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    expect(await NotificationsWrapper()).toBeNull();
    expect(alertService.getActiveAlertsForBorrower).not.toHaveBeenCalled();
    expect(
      debtTransactionService.getUserPendingTransactions,
    ).not.toHaveBeenCalled();
  });
});
