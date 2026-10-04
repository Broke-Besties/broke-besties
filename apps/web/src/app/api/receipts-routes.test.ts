import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/receipt.service", () => ({
  receiptService: {
    linkReceiptToDebts: vi.fn(),
    deleteReceipt: vi.fn(),
    uploadAndParseReceipt: vi.fn(),
    getReceiptItems: vi.fn(),
    parseReceiptItems: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { receiptService } from "@/services/receipt.service";
import {
  DELETE as deleteReceiptRoute,
  PATCH as linkReceiptRoute,
} from "@/app/api/receipts/[id]/route";
import { POST as uploadReceiptRoute } from "@/app/api/receipts/upload/route";
import { GET as receiptItemsRoute } from "@/app/api/receipts/[id]/items/route";
import { POST as parseReceiptRoute } from "@/app/api/receipts/[id]/parse/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };
const RECEIPT_ID = "receipt-1";
const DEBT_ACCESS_DENIED =
  "Access denied - you must be lender or borrower on all specified debts";

const context = () => ({ params: Promise.resolve({ id: RECEIPT_ID }) });

function patchRequest(body: string) {
  return new NextRequest(`http://localhost/api/receipts/${RECEIPT_ID}`, {
    method: "PATCH",
    body,
    headers: { "content-type": "application/json" },
  });
}

function deleteRequest() {
  return new NextRequest(`http://localhost/api/receipts/${RECEIPT_ID}`, {
    method: "DELETE",
  });
}

function uploadRequest(debtIds?: string) {
  const form = new FormData();
  form.append("file", new File(["fake image"], "receipt.jpg", { type: "image/jpeg" }));
  if (debtIds !== undefined) form.append("debtIds", debtIds);
  return new NextRequest("http://localhost/api/receipts/upload", {
    method: "POST",
    body: form,
  });
}

describe("receipt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getUser).mockResolvedValue(authUser as never);
  });

  describe("PATCH /api/receipts/[id]", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await linkReceiptRoute(patchRequest('{"debtIds":[1]}'), context());

      expect(res.status).toBe(401);
      expect(receiptService.linkReceiptToDebts).not.toHaveBeenCalled();
    });

    it("links the receipt to the debts", async () => {
      vi.mocked(receiptService.linkReceiptToDebts).mockResolvedValueOnce({
        success: true,
      });

      const res = await linkReceiptRoute(patchRequest('{"debtIds":[1,2]}'), context());

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(receiptService.linkReceiptToDebts).toHaveBeenCalledWith(
        RECEIPT_ID,
        [1, 2],
        LENDER_ID,
      );
    });

    it.each([
      ["a missing debtIds", "{}", "debtIds array is required"],
      ["an empty debtIds", '{"debtIds":[]}', "debtIds array is required"],
      ["a non-array debtIds", '{"debtIds":"1,2"}', "debtIds array is required"],
      ["a null body", "null", "debtIds array is required"],
      ["malformed JSON", "{not json", "debtIds array is required"],
      ["a non-integer debt id", '{"debtIds":[1,"2"]}', "Invalid debt ID"],
      ["a fractional debt id", '{"debtIds":[1.5]}', "Invalid debt ID"],
    ])("returns 400 for %s", async (_case, body, error) => {
      const res = await linkReceiptRoute(patchRequest(body), context());

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error });
      expect(receiptService.linkReceiptToDebts).not.toHaveBeenCalled();
    });

    it.each([
      ["Receipt not found", 404],
      ["Access denied", 403],
      [DEBT_ACCESS_DENIED, 403],
      ["Database exploded", 500],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(receiptService.linkReceiptToDebts).mockRejectedValueOnce(
        new Error(message),
      );

      const res = await linkReceiptRoute(patchRequest('{"debtIds":[1]}'), context());

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });
  });

  describe("DELETE /api/receipts/[id]", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await deleteReceiptRoute(deleteRequest(), context());

      expect(res.status).toBe(401);
      expect(receiptService.deleteReceipt).not.toHaveBeenCalled();
    });

    it("deletes the receipt", async () => {
      vi.mocked(receiptService.deleteReceipt).mockResolvedValueOnce({ success: true });

      const res = await deleteReceiptRoute(deleteRequest(), context());

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(receiptService.deleteReceipt).toHaveBeenCalledWith(RECEIPT_ID, LENDER_ID);
    });

    it.each([
      ["Receipt not found", 404],
      ["Access denied", 403],
      ["Storage unavailable", 500],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(receiptService.deleteReceipt).mockRejectedValueOnce(new Error(message));

      const res = await deleteReceiptRoute(deleteRequest(), context());

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });
  });

  describe("POST /api/receipts/upload", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await uploadReceiptRoute(uploadRequest());

      expect(res.status).toBe(401);
      expect(receiptService.uploadAndParseReceipt).not.toHaveBeenCalled();
    });

    it("uploads the receipt for the parsed debt ids", async () => {
      const data = { id: RECEIPT_ID, signedUrl: "https://signed" };
      vi.mocked(receiptService.uploadAndParseReceipt).mockResolvedValueOnce(data);

      const res = await uploadReceiptRoute(uploadRequest("[1,2]"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, data });
      expect(receiptService.uploadAndParseReceipt).toHaveBeenCalledWith(
        expect.any(File),
        LENDER_ID,
        [1, 2],
      );
    });

    it("returns 403 when the user isn't a party on the debts", async () => {
      vi.mocked(receiptService.uploadAndParseReceipt).mockRejectedValueOnce(
        new Error(DEBT_ACCESS_DENIED),
      );

      const res = await uploadReceiptRoute(uploadRequest("1,2"));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: DEBT_ACCESS_DENIED });
    });

    it("returns 500 for other failures", async () => {
      vi.mocked(receiptService.uploadAndParseReceipt).mockRejectedValueOnce(
        new Error("Failed to upload receipt: bucket not found"),
      );

      const res = await uploadReceiptRoute(uploadRequest());

      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/receipts/[id]/items and POST /api/receipts/[id]/parse", () => {
    it.each([
      ["Receipt not found", 404],
      ["Access denied", 403],
    ])("map %j to %i", async (message, status) => {
      vi.mocked(receiptService.getReceiptItems).mockRejectedValueOnce(new Error(message));
      vi.mocked(receiptService.parseReceiptItems).mockRejectedValueOnce(
        new Error(message),
      );
      const url = `http://localhost/api/receipts/${RECEIPT_ID}`;

      const items = await receiptItemsRoute(new NextRequest(`${url}/items`), context());
      const parse = await parseReceiptRoute(
        new NextRequest(`${url}/parse`, { method: "POST" }),
        context(),
      );

      expect(items.status).toBe(status);
      expect(parse.status).toBe(status);
    });
  });
});
