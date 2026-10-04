import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/lib/supabase", () => ({ createAdminClient: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase";
import { userService } from "@/services/user.service";
import { LENDER_ID, MockPrisma, makeUser } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserById returns the user or throws", async () => {
    db.user.findUnique.mockResolvedValueOnce(makeUser());
    const user = await userService.getUserById(LENDER_ID);
    expect(user.id).toBe(LENDER_ID);

    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(userService.getUserById("nope")).rejects.toThrow("User not found");
  });

  it("searchUserByEmail validates input and returns id+email only", async () => {
    await expect(userService.searchUserByEmail("")).rejects.toThrow(
      "Email parameter is required",
    );

    db.user.findUnique.mockResolvedValueOnce({ id: LENDER_ID, email: "l@x.com" });
    const user = await userService.searchUserByEmail("l@x.com");
    expect(user).toEqual({ id: LENDER_ID, email: "l@x.com" });
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "l@x.com" },
        select: { id: true, email: true },
      }),
    );

    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(userService.searchUserByEmail("nope@x.com")).rejects.toThrow(
      "User not found",
    );
  });

  it("updateUser passes data through to prisma", async () => {
    const updated = makeUser({ name: "New Name" });
    db.user.update.mockResolvedValueOnce(updated);

    const user = await userService.updateUser(LENDER_ID, { name: "New Name" });

    expect(user.name).toBe("New Name");
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: LENDER_ID },
      data: { name: "New Name" },
    });
  });

  describe("deleteAccount", () => {
    const removeObjects = vi.fn();
    const deleteAuthUser = vi.fn();
    let tx: ReturnType<typeof buildTx>;

    function buildTx(unlinkedReceiptIds = ["r1", "r2"]) {
      const write = () => vi.fn().mockResolvedValue({ count: 1 });
      return {
        groupInvite: { deleteMany: write() },
        friend: { deleteMany: write() },
        groupMember: { deleteMany: write() },
        tab: { deleteMany: write() },
        alert: { updateMany: write() },
        debtTransaction: { updateMany: write() },
        recurringPayment: { updateMany: write() },
        paypalAccount: { deleteMany: write() },
        receipt: {
          findMany: vi.fn().mockResolvedValue(unlinkedReceiptIds.map((id) => ({ id }))),
          deleteMany: write(),
        },
        user: { update: vi.fn().mockResolvedValue(makeUser({ name: "Deleted user" })) },
      };
    }

    const callOrder = (fn: Mock, call = 0) => fn.mock.invocationCallOrder[call];

    beforeEach(() => {
      tx = buildTx();
      db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(tx));
      db.user.findUnique.mockResolvedValue({ email: "larry@example.com" });
      removeObjects.mockResolvedValue({ data: [], error: null });
      deleteAuthUser.mockResolvedValue({ data: { user: null }, error: null });
      vi.mocked(createAdminClient).mockReturnValue({
        storage: { from: vi.fn(() => ({ remove: removeObjects })) },
        auth: { admin: { deleteUser: deleteAuthUser } },
      } as never);
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("anonymizes the user in one transaction, then removes receipt images and the auth user", async () => {
      await userService.deleteAccount(LENDER_ID);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.groupInvite.deleteMany).toHaveBeenNthCalledWith(1, {
        where: { invitedEmail: "larry@example.com" },
      });
      expect(tx.groupInvite.deleteMany).toHaveBeenNthCalledWith(2, {
        where: { invitedBy: LENDER_ID, status: "pending" },
      });
      expect(tx.friend.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ requesterId: LENDER_ID }, { recipientId: LENDER_ID }] },
      });
      expect(tx.groupMember.deleteMany).toHaveBeenCalledWith({ where: { userId: LENDER_ID } });
      expect(tx.tab.deleteMany).toHaveBeenCalledWith({ where: { userId: LENDER_ID } });
      expect(tx.alert.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ lenderId: LENDER_ID }, { borrowerId: LENDER_ID }] },
        data: { isActive: false },
      });
      expect(tx.debtTransaction.updateMany).toHaveBeenCalledWith({
        where: { requesterId: LENDER_ID, status: "pending" },
        data: { status: "cancelled", resolvedAt: expect.any(Date) },
      });
      expect(tx.recurringPayment.updateMany).toHaveBeenCalledWith({
        where: { lenderId: LENDER_ID },
        data: { status: "inactive" },
      });
      expect(tx.paypalAccount.deleteMany).toHaveBeenCalledWith({ where: { userId: LENDER_ID } });
      expect(tx.receipt.findMany).toHaveBeenCalledWith({
        where: { uploaderId: LENDER_ID, debts: { none: {} } },
        select: { id: true },
      });
      expect(tx.receipt.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["r1", "r2"] } },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: LENDER_ID },
        data: {
          name: "Deleted user",
          email: `deleted+${LENDER_ID}@users.brokebesties.invalid`,
        },
      });

      // Plan order: received invites go first and the email changes last, because
      // GroupInvite.invitedEmail follows User.email (ON UPDATE CASCADE).
      const order = [
        callOrder(tx.groupInvite.deleteMany, 0),
        callOrder(tx.groupInvite.deleteMany, 1),
        callOrder(tx.friend.deleteMany),
        callOrder(tx.groupMember.deleteMany),
        callOrder(tx.tab.deleteMany),
        callOrder(tx.alert.updateMany),
        callOrder(tx.debtTransaction.updateMany),
        callOrder(tx.recurringPayment.updateMany),
        callOrder(tx.paypalAccount.deleteMany),
        callOrder(tx.receipt.findMany),
        callOrder(tx.receipt.deleteMany),
        callOrder(tx.user.update),
        callOrder(removeObjects),
        callOrder(deleteAuthUser),
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));

      expect(removeObjects).toHaveBeenCalledWith(["receipts/r1", "receipts/r2"]);
      expect(deleteAuthUser).toHaveBeenCalledWith(LENDER_ID);
    });

    it("skips storage when there are no unlinked receipts", async () => {
      tx = buildTx([]);

      await userService.deleteAccount(LENDER_ID);

      expect(removeObjects).not.toHaveBeenCalled();
      expect(deleteAuthUser).toHaveBeenCalledWith(LENDER_ID);
    });

    it("still deletes the auth user when removing receipt images fails", async () => {
      removeObjects
        .mockResolvedValueOnce({ data: null, error: new Error("Storage down") })
        .mockRejectedValueOnce(new Error("socket hang up"));

      await expect(userService.deleteAccount(LENDER_ID)).resolves.toBeUndefined();
      await expect(userService.deleteAccount(LENDER_ID)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(deleteAuthUser).toHaveBeenCalledTimes(2);
    });

    it("treats an auth user that's already gone (404) as deleted, so retries are safe", async () => {
      deleteAuthUser.mockResolvedValueOnce({
        data: { user: null },
        error: { status: 404, code: "user_not_found", message: "User not found" },
      });

      await expect(userService.deleteAccount(LENDER_ID)).resolves.toBeUndefined();
    });

    it("throws any other auth error", async () => {
      deleteAuthUser.mockResolvedValueOnce({
        data: { user: null },
        error: Object.assign(new Error("Database error deleting user"), { status: 500 }),
      });

      await expect(userService.deleteAccount(LENDER_ID)).rejects.toThrow(
        "Database error deleting user",
      );
    });

    it("still deletes the auth user when the User row doesn't exist", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await userService.deleteAccount(LENDER_ID);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(removeObjects).not.toHaveBeenCalled();
      expect(deleteAuthUser).toHaveBeenCalledWith(LENDER_ID);
    });

    it("keeps the auth user when the transaction fails", async () => {
      tx.user.update.mockRejectedValueOnce(new Error("deadlock detected"));

      await expect(userService.deleteAccount(LENDER_ID)).rejects.toThrow("deadlock detected");

      expect(removeObjects).not.toHaveBeenCalled();
      expect(deleteAuthUser).not.toHaveBeenCalled();
    });
  });
});
