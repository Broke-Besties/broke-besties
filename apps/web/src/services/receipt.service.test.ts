import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/agents/ReceiptItemParser", () => ({ extractReceiptItems: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { extractReceiptItems } from "@/agents/ReceiptItemParser";
import { receiptService } from "@/services/receipt.service";
import { MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

const USER_A = "user-a";
const USER_B = "user-b";
const USER_C = "user-c";
const RECEIPT_ID = "receipt-1";

type LinkedDebt = { id: number; lenderId: string; borrowerId: string };
type StoredReceipt = {
  id: string;
  uploaderId: string | null;
  rawText: string | null;
  debts: LinkedDebt[];
};

let stored: StoredReceipt | null = null;

// A one-row stand-in for the Receipt table: reads only return `debts` when the
// query includes them, like Prisma.
function useReceiptStore() {
  stored = null;
  const read = async (args: { include?: { debts?: unknown } }) => {
    if (!stored) return null;
    const { debts, ...row } = stored;
    return args.include?.debts ? { ...row, items: [], debts: [...debts] } : row;
  };

  db.receipt.create.mockImplementation(
    async ({ data }: { data: { uploaderId?: string } }) => {
      const uploaderId = data.uploaderId ?? null;
      stored = { id: RECEIPT_ID, uploaderId, rawText: null, debts: [] };
      return { id: RECEIPT_ID, uploaderId, rawText: null };
    },
  );
  db.receipt.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      if (!stored) throw new Error("Record to update not found.");
      if ("uploaderId" in data) stored.uploaderId = data.uploaderId as string;
      return { id: stored.id };
    },
  );
  db.receipt.findFirst.mockImplementation(read);
  db.receipt.findUnique.mockImplementation(read);
  db.receipt.delete.mockImplementation(async () => {
    stored = null;
    return { id: RECEIPT_ID };
  });
}

async function uploadAs(userId: string) {
  const file = new File(["fake image"], "receipt.jpg", { type: "image/jpeg" });
  return receiptService.uploadAndParseReceipt(file, userId);
}

function linkStoredReceiptTo(debts: LinkedDebt[]) {
  stored!.debts = debts;
}

describe("receiptService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(createClient).mockImplementation(
      () => ({ storage: { from: storage.from } }) as never,
    );
    storage.from.mockReturnValue({
      upload: storage.upload,
      createSignedUrl: storage.createSignedUrl,
      remove: storage.remove,
    });
    storage.upload.mockResolvedValue({ data: { path: "x" }, error: null });
    storage.createSignedUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://storage.test/${path}?token=t` },
      error: null,
    }));
    storage.remove.mockResolvedValue({ data: [], error: null });
    vi.mocked(extractReceiptItems).mockResolvedValue({
      rawText: "COFFEE 4.50",
      items: [{ name: "Coffee", price: 4.5 }],
    });
    db.receiptItem.findMany.mockResolvedValue([]);
    db.debt.findMany.mockResolvedValue([]);

    useReceiptStore();
  });

  it("records the uploader when the row is created, so the receipt is never open mid-upload", async () => {
    let uploaderDuringUpload: string | null | undefined;
    storage.upload.mockImplementationOnce(async () => {
      uploaderDuringUpload = stored?.uploaderId;
      return { data: { path: "x" }, error: null };
    });

    await uploadAs(USER_A);

    expect(uploaderDuringUpload).toBe(USER_A);
  });

  describe("a pending receipt (uploaded by A, no debts yet)", () => {
    beforeEach(async () => {
      await uploadAs(USER_A);
      expect(stored?.uploaderId).toBe(USER_A);
      vi.clearAllMocks();
    });

    it("getReceiptItems: denies B and allows A", async () => {
      await expect(receiptService.getReceiptItems(RECEIPT_ID, USER_B)).rejects.toThrow(
        "Access denied",
      );
      expect(db.receiptItem.findMany).not.toHaveBeenCalled();

      const items = [{ id: "item-1", name: "Coffee", price: 4.5 }];
      db.receiptItem.findMany.mockResolvedValueOnce(items);
      await expect(receiptService.getReceiptItems(RECEIPT_ID, USER_A)).resolves.toEqual(
        items,
      );
    });

    it("parseReceiptItems: denies B before reading the image, allows A", async () => {
      await expect(receiptService.parseReceiptItems(RECEIPT_ID, USER_B)).rejects.toThrow(
        "Access denied",
      );
      expect(storage.createSignedUrl).not.toHaveBeenCalled();
      expect(extractReceiptItems).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();

      await expect(receiptService.parseReceiptItems(RECEIPT_ID, USER_A)).resolves.toEqual({
        id: RECEIPT_ID,
        rawText: "COFFEE 4.50",
        items: [{ name: "Coffee", price: 4.5 }],
      });
      expect(extractReceiptItems).toHaveBeenCalledWith(
        `https://storage.test/receipts/${RECEIPT_ID}?token=t`,
      );
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("deleteReceipt: only the uploader can delete it", async () => {
      await expect(receiptService.deleteReceipt(RECEIPT_ID, USER_B)).rejects.toThrow(
        "Access denied",
      );
      expect(storage.remove).not.toHaveBeenCalled();
      expect(db.receipt.delete).not.toHaveBeenCalled();

      await expect(receiptService.deleteReceipt(RECEIPT_ID, USER_A)).resolves.toEqual({
        success: true,
      });
      expect(storage.remove).toHaveBeenCalledWith([`receipts/${RECEIPT_ID}`]);
      expect(db.receipt.delete).toHaveBeenCalledWith({ where: { id: RECEIPT_ID } });
    });

    it("linkReceiptToDebts: B can't attach A's receipt to B's own debt; A can", async () => {
      // B is a party on debt 7, so only the receipt check can stop this.
      db.debt.findMany.mockResolvedValue([{ id: 7 }]);
      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [7], USER_B),
      ).rejects.toThrow("Access denied");
      expect(db.receipt.update).not.toHaveBeenCalled();

      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [7], USER_A),
      ).resolves.toEqual({ success: true });
      expect(db.receipt.update).toHaveBeenCalledWith({
        where: { id: RECEIPT_ID },
        data: { debts: { connect: [{ id: 7 }] } },
      });
    });

    it("linkReceiptToDebts: still requires A to be a party on every target debt", async () => {
      db.debt.findMany.mockResolvedValueOnce([{ id: 7 }]);

      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [7, 8], USER_A),
      ).rejects.toThrow(
        "Access denied - you must be lender or borrower on all specified debts",
      );
      expect(db.receipt.update).not.toHaveBeenCalled();
    });
  });

  describe("a receipt linked to a debt between A (lender) and B (borrower)", () => {
    beforeEach(async () => {
      await uploadAs(USER_A);
      linkStoredReceiptTo([{ id: 5, lenderId: USER_A, borrowerId: USER_B }]);
      vi.clearAllMocks();
    });

    it("lets either party read it and denies outsiders", async () => {
      await expect(receiptService.getReceiptItems(RECEIPT_ID, USER_B)).resolves.toEqual([]);
      await expect(receiptService.getReceiptItems(RECEIPT_ID, USER_C)).rejects.toThrow(
        "Access denied",
      );
      await expect(receiptService.parseReceiptItems(RECEIPT_ID, USER_C)).rejects.toThrow(
        "Access denied",
      );
      expect(extractReceiptItems).not.toHaveBeenCalled();
    });

    it("lets a party on an already-linked debt link it again, not an outsider", async () => {
      db.debt.findMany.mockResolvedValue([{ id: 9 }]);

      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [9], USER_B),
      ).resolves.toEqual({ success: true });

      db.receipt.update.mockClear();
      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [9], USER_C),
      ).rejects.toThrow("Access denied");
      expect(db.receipt.update).not.toHaveBeenCalled();
    });

    it("lets either party delete it and denies outsiders", async () => {
      await expect(receiptService.deleteReceipt(RECEIPT_ID, USER_C)).rejects.toThrow(
        "Access denied",
      );
      expect(db.receipt.delete).not.toHaveBeenCalled();

      await expect(receiptService.deleteReceipt(RECEIPT_ID, USER_B)).resolves.toEqual({
        success: true,
      });
    });
  });

  describe("a legacy receipt (no uploader recorded, no debts)", () => {
    beforeEach(() => {
      stored = { id: RECEIPT_ID, uploaderId: null, rawText: null, debts: [] };
    });

    it("can't be linked by anyone, since nobody can prove they own it", async () => {
      db.debt.findMany.mockResolvedValue([{ id: 7 }]);

      await expect(
        receiptService.linkReceiptToDebts(RECEIPT_ID, [7], USER_B),
      ).rejects.toThrow("Access denied");
      expect(db.receipt.update).not.toHaveBeenCalled();
    });

    it("can still be deleted", async () => {
      await expect(receiptService.deleteReceipt(RECEIPT_ID, USER_B)).resolves.toEqual({
        success: true,
      });
    });
  });

  describe("getSignedImageUrls", () => {
    it("returns [] for no ids without creating a client", async () => {
      await expect(receiptService.getSignedImageUrls([])).resolves.toEqual([]);
      expect(createClient).not.toHaveBeenCalled();
    });

    it("signs receipts/{id} for an hour and keeps the input order", async () => {
      // The first URL comes back last
      storage.createSignedUrl.mockImplementation(async (path: string) => {
        if (path === "receipts/a") await new Promise((resolve) => setTimeout(resolve, 5));
        return { data: { signedUrl: `https://storage.test/${path}` }, error: null };
      });

      await expect(receiptService.getSignedImageUrls(["a", "b", "c"])).resolves.toEqual([
        { id: "a", url: "https://storage.test/receipts/a" },
        { id: "b", url: "https://storage.test/receipts/b" },
        { id: "c", url: "https://storage.test/receipts/c" },
      ]);
      expect(storage.from).toHaveBeenCalledWith("receipts");
      expect(storage.createSignedUrl).toHaveBeenCalledWith("receipts/a", 3600);
    });

    it("skips and logs the URLs that fail", async () => {
      storage.createSignedUrl.mockImplementation(async (path: string) => {
        if (path === "receipts/missing") {
          return { data: null, error: new Error("Object not found") };
        }
        if (path === "receipts/boom") throw new Error("socket hang up");
        return { data: { signedUrl: `https://storage.test/${path}` }, error: null };
      });

      await expect(
        receiptService.getSignedImageUrls(["missing", "ok", "boom"]),
      ).resolves.toEqual([{ id: "ok", url: "https://storage.test/receipts/ok" }]);
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("returns [] and logs when the storage client can't be created", async () => {
      vi.mocked(createClient).mockImplementationOnce(() => {
        throw new Error("supabaseUrl is required.");
      });

      await expect(receiptService.getSignedImageUrls(["a"])).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  it("throws 'Receipt not found' for a missing receipt", async () => {
    await expect(receiptService.getReceiptItems("missing", USER_A)).rejects.toThrow(
      "Receipt not found",
    );
    await expect(receiptService.parseReceiptItems("missing", USER_A)).rejects.toThrow(
      "Receipt not found",
    );
    await expect(receiptService.deleteReceipt("missing", USER_A)).rejects.toThrow(
      "Receipt not found",
    );
    await expect(
      receiptService.linkReceiptToDebts("missing", [1], USER_A),
    ).rejects.toThrow("Receipt not found");
  });
});
