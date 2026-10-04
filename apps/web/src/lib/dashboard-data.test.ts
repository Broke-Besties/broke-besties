import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/lib/nav-counts", () => ({ getNavCounts: vi.fn() }));
vi.mock("@/services/debt.service", () => ({ debtService: { getUserDebts: vi.fn() } }));
vi.mock("@/services/group.service", () => ({ groupService: { getUserGroups: vi.fn() } }));
vi.mock("@/services/tab.service", () => ({ tabService: { getUserTabs: vi.fn() } }));
vi.mock("@/services/recurring-payment.service", () => ({
  recurringPaymentService: { getUserRecurringPayments: vi.fn() },
}));
vi.mock("@/services/alert.service", () => ({
  alertService: { getActiveAlertsForBorrower: vi.fn() },
}));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: { getUserPendingTransactions: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { getNavCounts } from "@/lib/nav-counts";
import { debtService } from "@/services/debt.service";
import { groupService } from "@/services/group.service";
import { tabService } from "@/services/tab.service";
import { recurringPaymentService } from "@/services/recurring-payment.service";
import { alertService } from "@/services/alert.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { getDashboardData } from "@/lib/dashboard-data";
import { BORROWER_ID, LENDER_ID, MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const counts = { debtRequests: 1, invites: 0, friendRequests: 2 };

describe("getDashboardData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(debtService.getUserDebts).mockResolvedValue([{ id: 1 }] as never);
    vi.mocked(groupService.getUserGroups).mockResolvedValue([{ id: 2 }] as never);
    vi.mocked(tabService.getUserTabs).mockResolvedValue([{ id: 3 }] as never);
    vi.mocked(recurringPaymentService.getUserRecurringPayments).mockResolvedValue([
      { id: 4 },
    ] as never);
    vi.mocked(alertService.getActiveAlertsForBorrower).mockResolvedValue([{ id: 5 }] as never);
    vi.mocked(debtTransactionService.getUserPendingTransactions).mockResolvedValue([]);
    vi.mocked(getNavCounts).mockResolvedValue(counts);
  });

  it("loads the home screen data and returns exactly the API shape", async () => {
    const dbUser = { id: LENDER_ID, email: "larry@x.com", name: "Larry" };
    db.user.findUnique.mockResolvedValueOnce(dbUser);
    const awaitingMe = { id: 10, lenderApproved: false, debt: { lenderId: LENDER_ID } };
    vi.mocked(debtTransactionService.getUserPendingTransactions).mockResolvedValueOnce([
      awaitingMe,
      { id: 11, lenderApproved: true, debt: { lenderId: LENDER_ID } },
      { id: 12, lenderApproved: false, debt: { lenderId: BORROWER_ID } },
    ] as never);

    const data = await getDashboardData({ id: LENDER_ID, email: "larry@x.com" });

    expect(data).toStrictEqual({
      user: dbUser,
      debts: [{ id: 1 }],
      groups: [{ id: 2 }],
      tabs: [{ id: 3 }],
      recurringPayments: [{ id: 4 }],
      alerts: [{ id: 5 }],
      pendingApprovals: [awaitingMe],
      counts,
    });
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: LENDER_ID },
      select: { id: true, email: true, name: true },
    });
    expect(debtService.getUserDebts).toHaveBeenCalledWith(LENDER_ID, { status: "pending" });
    expect(groupService.getUserGroups).toHaveBeenCalledWith(LENDER_ID);
    expect(tabService.getUserTabs).toHaveBeenCalledWith(LENDER_ID);
    expect(recurringPaymentService.getUserRecurringPayments).toHaveBeenCalledWith(LENDER_ID, {
      status: "active",
    });
    expect(alertService.getActiveAlertsForBorrower).toHaveBeenCalledWith(LENDER_ID);
    expect(debtTransactionService.getUserPendingTransactions).toHaveBeenCalledWith(LENDER_ID);
    expect(getNavCounts).toHaveBeenCalledWith(LENDER_ID, "larry@x.com");
  });

  it("falls back to the auth email and a null name when the user row is missing", async () => {
    db.user.findUnique.mockResolvedValue(null);

    let data = await getDashboardData({ id: LENDER_ID, email: "larry@x.com" });
    expect(data.user).toStrictEqual({ id: LENDER_ID, email: "larry@x.com", name: null });

    data = await getDashboardData({ id: LENDER_ID, email: null });
    expect(data.user).toStrictEqual({ id: LENDER_ID, email: "", name: null });
    expect(getNavCounts).toHaveBeenLastCalledWith(LENDER_ID, "");
  });
});
