import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import {
  AlertPolicy,
  DebtPolicy,
  DebtTransactionPolicy,
  GroupPolicy,
  InvitePolicy,
  ReceiptPolicy,
} from "@/policies";
import { FriendPolicy } from "@/policies/friend.policy";
import { TabPolicy } from "@/policies/tab.policy";
import { createMockEmailService, type MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

vi.mock("@/services/email.service", () => ({
  emailService: createMockEmailService(),
}));

describe("DebtPolicy", () => {
  describe("canView (pure)", () => {
    it("allows lender or borrower", () => {
      expect(DebtPolicy.canView("u1", { lenderId: "u1", borrowerId: "u2" })).toBe(true);
      expect(DebtPolicy.canView("u2", { lenderId: "u1", borrowerId: "u2" })).toBe(true);
    });

    it("rejects everyone else", () => {
      expect(DebtPolicy.canView("u3", { lenderId: "u1", borrowerId: "u2" })).toBe(false);
    });
  });

  describe("canUpdate", () => {
    it("returns canUpdate=false with null debt when missing", async () => {
      db.debt.findUnique.mockResolvedValueOnce(null);

      const result = await DebtPolicy.canUpdate("u1", 999);

      expect(result.canUpdate).toBe(false);
      expect(result.isLender).toBe(false);
      expect(result.debt).toBeNull();
    });

    it("marks lender as able to update", async () => {
      db.debt.findUnique.mockResolvedValueOnce({ id: 1, lenderId: "u1", borrowerId: "u2" });

      const result = await DebtPolicy.canUpdate("u1", 1);

      expect(result.canUpdate).toBe(true);
      expect(result.isLender).toBe(true);
    });

    it("allows borrower to update but not as lender", async () => {
      db.debt.findUnique.mockResolvedValueOnce({ id: 1, lenderId: "u1", borrowerId: "u2" });

      const result = await DebtPolicy.canUpdate("u2", 1);

      expect(result.canUpdate).toBe(true);
      expect(result.isLender).toBe(false);
    });
  });

  describe("canDelete", () => {
    it("allows only the lender", async () => {
      db.debt.findUnique.mockResolvedValueOnce({ lenderId: "u1" });
      expect(await DebtPolicy.canDelete("u1", 1)).toBe(true);

      db.debt.findUnique.mockResolvedValueOnce({ lenderId: "u1" });
      expect(await DebtPolicy.canDelete("u2", 1)).toBe(false);

      db.debt.findUnique.mockResolvedValueOnce(null);
      expect(await DebtPolicy.canDelete("u1", 999)).toBe(false);
    });
  });
});

describe("DebtTransactionPolicy (pure)", () => {
  const debt = { lenderId: "u1", borrowerId: "u2" };
  const pending = {
    status: "pending",
    requesterId: "u2",
    lenderApproved: false,
    borrowerApproved: false,
    debt,
  };

  it("canCreate: only debt parties", () => {
    expect(DebtTransactionPolicy.canCreate("u1", debt)).toBe(true);
    expect(DebtTransactionPolicy.canCreate("u3", debt)).toBe(false);
  });

  it("canCancel: only the requester while pending", () => {
    expect(DebtTransactionPolicy.canCancel("u2", pending)).toBe(true);
    expect(DebtTransactionPolicy.canCancel("u1", pending)).toBe(false);
    expect(
      DebtTransactionPolicy.canCancel("u2", { ...pending, status: "approved" }),
    ).toBe(false);
  });

  it("needsApproval: unapproved party on pending tx", () => {
    expect(DebtTransactionPolicy.needsApproval("u1", pending)).toBe(true);
    expect(DebtTransactionPolicy.needsApproval("u2", pending)).toBe(true);
    expect(DebtTransactionPolicy.needsApproval("u3", pending)).toBe(false);
    expect(
      DebtTransactionPolicy.needsApproval("u1", {
        ...pending,
        lenderApproved: true,
      }),
    ).toBe(false);
    expect(
      DebtTransactionPolicy.needsApproval("u1", { ...pending, status: "rejected" }),
    ).toBe(false);
  });

  it("getUserStatus reports role and approval state", () => {
    const status = DebtTransactionPolicy.getUserStatus("u1", pending);

    expect(status).toEqual({
      isLender: true,
      isBorrower: false,
      hasApproved: false,
      needsToApprove: true,
    });
  });
});

describe("FriendPolicy (pure)", () => {
  it("canAcceptOrReject: recipient + pending only", () => {
    const req = { recipientId: "u2", status: "pending" };
    expect(FriendPolicy.canAcceptOrReject("u2", req)).toBe(true);
    expect(FriendPolicy.canAcceptOrReject("u1", req)).toBe(false);
    expect(FriendPolicy.canAcceptOrReject("u2", { ...req, status: "accepted" })).toBe(
      false,
    );
  });

  it("canCancel: requester + pending only", () => {
    const req = { requesterId: "u1", status: "pending" };
    expect(FriendPolicy.canCancel("u1", req)).toBe(true);
    expect(FriendPolicy.canCancel("u2", req)).toBe(false);
  });

  it("canRemove: either party of an accepted friendship", () => {
    const accepted = { requesterId: "u1", recipientId: "u2", status: "accepted" };
    expect(FriendPolicy.canRemove("u1", accepted)).toBe(true);
    expect(FriendPolicy.canRemove("u2", accepted)).toBe(true);
    expect(FriendPolicy.canRemove("u3", accepted)).toBe(false);
    expect(
      FriendPolicy.canRemove("u1", { ...accepted, status: "pending" }),
    ).toBe(false);
  });

  it("isInvolved: either party", () => {
    expect(
      FriendPolicy.isInvolved("u1", { requesterId: "u1", recipientId: "u2" }),
    ).toBe(true);
    expect(
      FriendPolicy.isInvolved("u3", { requesterId: "u1", recipientId: "u2" }),
    ).toBe(false);
  });
});

describe("GroupPolicy", () => {
  it("canView (pure): member check on the group object", () => {
    const group = { members: [{ userId: "u1" }, { userId: "u2" }] };
    expect(GroupPolicy.canView("u1", group)).toBe(true);
    expect(GroupPolicy.canView("u3", group)).toBe(false);
    expect(GroupPolicy.canView("u1", { members: [] })).toBe(false);
  });

  it("canCreate: any non-empty userId", () => {
    expect(GroupPolicy.canCreate("u1")).toBe(true);
    expect(GroupPolicy.canCreate("")).toBe(false);
  });

  it("isMember: queries groupMember", async () => {
    db.groupMember.findFirst.mockResolvedValueOnce({ id: 1 });
    expect(await GroupPolicy.isMember("u1", 5)).toBe(true);

    db.groupMember.findFirst.mockResolvedValueOnce(null);
    expect(await GroupPolicy.isMember("u3", 5)).toBe(false);
  });
});

describe("InvitePolicy", () => {
  it("canAccept (pure): matching email + pending", () => {
    const invite = { invitedEmail: "a@x.com", status: "pending" };
    expect(InvitePolicy.canAccept("a@x.com", invite)).toBe(true);
    expect(InvitePolicy.canAccept("b@x.com", invite)).toBe(false);
    expect(InvitePolicy.canAccept("a@x.com", { ...invite, status: "accepted" })).toBe(
      false,
    );
  });

  it("canCancel (pure): sender + pending", () => {
    const invite = { invitedBy: "u1", status: "pending" };
    expect(InvitePolicy.canCancel("u1", invite)).toBe(true);
    expect(InvitePolicy.canCancel("u2", invite)).toBe(false);
  });

  it("canReject (pure): matching email + pending", () => {
    const invite = { invitedEmail: "a@x.com", status: "pending" };
    expect(InvitePolicy.canReject("a@x.com", invite)).toBe(true);
    expect(InvitePolicy.canReject("b@x.com", invite)).toBe(false);
  });

  it("inviteExists: finds by group+email", async () => {
    db.groupInvite.findUnique.mockResolvedValueOnce({ id: 1 });
    expect(await InvitePolicy.inviteExists(1, "a@x.com")).toBe(true);

    db.groupInvite.findUnique.mockResolvedValueOnce(null);
    expect(await InvitePolicy.inviteExists(1, "b@x.com")).toBe(false);
  });

  it("isAlreadyMember: user with membership in group", async () => {
    db.user.findUnique.mockResolvedValueOnce({ members: [{ id: 1 }] });
    expect(await InvitePolicy.isAlreadyMember(1, "a@x.com")).toBe(true);

    db.user.findUnique.mockResolvedValueOnce({ members: [] });
    expect(await InvitePolicy.isAlreadyMember(1, "a@x.com")).toBe(false);

    db.user.findUnique.mockResolvedValueOnce(null);
    expect(await InvitePolicy.isAlreadyMember(1, "nobody@x.com")).toBe(false);
  });
});

describe("ReceiptPolicy", () => {
  const receipt = {
    debts: [
      { lenderId: "u1", borrowerId: "u2" },
      { lenderId: "u3", borrowerId: "u4" },
    ],
  };

  it("canView (pure): party on any linked debt", () => {
    expect(ReceiptPolicy.canView("u2", receipt)).toBe(true);
    expect(ReceiptPolicy.canView("u3", receipt)).toBe(true);
    expect(ReceiptPolicy.canView("u5", receipt)).toBe(false);
  });

  it("canDelete (pure): same rule as canView", () => {
    expect(ReceiptPolicy.canDelete("u1", receipt)).toBe(true);
    expect(ReceiptPolicy.canDelete("u5", receipt)).toBe(false);
  });

  it("canCreate: user must have access to all provided debts", async () => {
    db.debt.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    expect(await ReceiptPolicy.canCreate("u1", [1, 2])).toBe(true);

    db.debt.findMany.mockResolvedValueOnce([{ id: 1 }]);
    expect(await ReceiptPolicy.canCreate("u1", [1, 2])).toBe(false);

    db.debt.findMany.mockClear();
    expect(await ReceiptPolicy.canCreate("u1", [])).toBe(false);
    expect(db.debt.findMany).not.toHaveBeenCalled();
  });
});

describe("TabPolicy (pure)", () => {
  const tab = { userId: "u1" };

  it("isOwner/canView/canUpdate/canDelete: owner only", () => {
    expect(TabPolicy.isOwner("u1", tab)).toBe(true);
    expect(TabPolicy.isOwner("u2", tab)).toBe(false);
    expect(TabPolicy.canView("u1", tab)).toBe(true);
    expect(TabPolicy.canUpdate("u2", tab)).toBe(false);
    expect(TabPolicy.canDelete("u2", tab)).toBe(false);
  });

  it("isValidStatus", () => {
    expect(TabPolicy.isValidStatus("lending")).toBe(true);
    expect(TabPolicy.isValidStatus("borrowing")).toBe(true);
    expect(TabPolicy.isValidStatus("paid")).toBe(true);
    expect(TabPolicy.isValidStatus("settled")).toBe(false);
  });
});

describe("AlertPolicy", () => {
  it("canView (pure): lender or borrower", () => {
    expect(AlertPolicy.canView("u1", { lenderId: "u1", borrowerId: "u2" })).toBe(true);
    expect(AlertPolicy.canView("u2", { lenderId: "u1", borrowerId: "u2" })).toBe(true);
    expect(AlertPolicy.canView("u3", { lenderId: "u1", borrowerId: "u2" })).toBe(false);
  });

  it("canUpdate: only lender, null alert if missing", async () => {
    db.alert.findUnique.mockResolvedValueOnce({ lenderId: "u1", borrowerId: "u2" });
    const ok = await AlertPolicy.canUpdate("u1", 1);
    expect(ok.canUpdate).toBe(true);
    expect(ok.isLender).toBe(true);

    db.alert.findUnique.mockResolvedValueOnce({ lenderId: "u1", borrowerId: "u2" });
    expect((await AlertPolicy.canUpdate("u2", 1)).canUpdate).toBe(false);

    db.alert.findUnique.mockResolvedValueOnce(null);
    const missing = await AlertPolicy.canUpdate("u1", 999);
    expect(missing.canUpdate).toBe(false);
    expect(missing.alert).toBeNull();
  });

  it("canDelete: only lender or missing alert", async () => {
    db.alert.findUnique.mockResolvedValueOnce({ lenderId: "u1" });
    expect(await AlertPolicy.canDelete("u1", 1)).toBe(true);

    db.alert.findUnique.mockResolvedValueOnce({ lenderId: "u1" });
    expect(await AlertPolicy.canDelete("u2", 1)).toBe(false);

    db.alert.findUnique.mockResolvedValueOnce(null);
    expect(await AlertPolicy.canDelete("u1", 999)).toBe(false);
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
