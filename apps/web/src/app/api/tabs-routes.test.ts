import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/tab.service", () => ({
  tabService: {
    getUserTabs: vi.fn(),
    createTab: vi.fn(),
    updateTab: vi.fn(),
    deleteTab: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { tabService } from "@/services/tab.service";
import { GET as listTabs, POST as createTab } from "@/app/api/tabs/route";
import { PATCH as updateTab, DELETE as deleteTab } from "@/app/api/tabs/[id]/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

function request(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const tab = {
  id: 1,
  amount: 25,
  description: "Concert tickets",
  personName: "Mike",
  status: "borrowing",
  userId: LENDER_ID,
};

describe("tabs routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET /api/tabs", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await listTabs(new NextRequest("http://localhost/api/tabs"));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
      expect(tabService.getUserTabs).not.toHaveBeenCalled();
    });

    it("lists the user's tabs, passing the status filter through", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);
      vi.mocked(tabService.getUserTabs).mockResolvedValue([tab] as never);

      let res = await listTabs(new NextRequest("http://localhost/api/tabs?status=lending"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tabs: [tab] });
      expect(tabService.getUserTabs).toHaveBeenLastCalledWith(LENDER_ID, { status: "lending" });

      res = await listTabs(new NextRequest("http://localhost/api/tabs"));
      expect(res.status).toBe(200);
      expect(tabService.getUserTabs).toHaveBeenLastCalledWith(LENDER_ID, { status: null });
    });

    it("hides unexpected errors behind a logged 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.getUserTabs).mockRejectedValueOnce(new Error("db down"));

      const res = await listTabs(new NextRequest("http://localhost/api/tabs"));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("POST /api/tabs", () => {
    const url = "http://localhost/api/tabs";
    const body = { amount: 25, description: "Concert tickets", personName: "Mike" };

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await createTab(request("POST", url, body));

      expect(res.status).toBe(401);
      expect(tabService.createTab).not.toHaveBeenCalled();
    });

    it("creates a borrowing tab by default and returns 201", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.createTab).mockResolvedValueOnce(tab as never);

      const res = await createTab(request("POST", url, body));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ tab });
      expect(tabService.createTab).toHaveBeenCalledWith({
        ...body,
        userId: LENDER_ID,
        status: "borrowing",
      });
    });

    it("passes an explicit status through and ignores a userId in the body", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);
      vi.mocked(tabService.createTab).mockResolvedValue(tab as never);

      await createTab(request("POST", url, { ...body, status: "lending", userId: "someone-else" }));
      expect(tabService.createTab).toHaveBeenLastCalledWith({
        ...body,
        userId: LENDER_ID,
        status: "lending",
      });

      await createTab(request("POST", url, { ...body, status: null }));
      expect(tabService.createTab).toHaveBeenLastCalledWith({
        ...body,
        userId: LENDER_ID,
        status: "borrowing",
      });
    });

    it.each([
      "Valid amount is required",
      "Description is required",
      "Person name is required",
      "Invalid status value",
    ])("maps the service error %j to 400", async (message) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.createTab).mockRejectedValueOnce(new Error(message));

      const res = await createTab(request("POST", url, body));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: message });
    });

    it.each([
      ["a string amount", { ...body, amount: "12" }, "Valid amount is required"],
      ["a missing amount", { description: "x", personName: "y" }, "Valid amount is required"],
      ["a numeric description", { ...body, description: 5 }, "Description is required"],
      ["a null person name", { ...body, personName: null }, "Person name is required"],
      ["a non-string status", { ...body, status: 5 }, "Invalid status value"],
      ["status 'paid'", { ...body, status: "paid" }, "Invalid status value"],
    ])("rejects %s with the service's message", async (_label, payload, message) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await createTab(request("POST", url, payload));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: message });
      expect(tabService.createTab).not.toHaveBeenCalled();
    });

    it("rejects an infinite amount", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await createTab(
        request("POST", url, '{"amount":1e999,"description":"x","personName":"y"}'),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Valid amount is required" });
    });

    it.each([
      ["malformed JSON", "{not json"],
      ["JSON null", "null"],
    ])("returns 400 for %s", async (_label, raw) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await createTab(request("POST", url, raw));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });
      expect(tabService.createTab).not.toHaveBeenCalled();
    });

    it("hides unexpected errors behind a 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.createTab).mockRejectedValueOnce(new Error("db down"));

      const res = await createTab(request("POST", url, body));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
    });
  });

  describe("PATCH /api/tabs/[id]", () => {
    const url = "http://localhost/api/tabs/1";

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await updateTab(request("PATCH", url, { status: "paid" }), params("1"));

      expect(res.status).toBe(401);
      expect(tabService.updateTab).not.toHaveBeenCalled();
    });

    it.each(["abc", "1abc", "2147483648"])(
      "returns 400 for the invalid id %j",
      async (id) => {
        vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

        const res = await updateTab(request("PATCH", url, { status: "paid" }), params(id));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Invalid tab ID" });
        expect(tabService.updateTab).not.toHaveBeenCalled();
      },
    );

    it("updates the tab and returns it", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);
      vi.mocked(tabService.updateTab).mockResolvedValue({ ...tab, status: "paid" } as never);

      let res = await updateTab(request("PATCH", url, { status: "paid" }), params("1"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tab: { ...tab, status: "paid" } });
      expect(tabService.updateTab).toHaveBeenLastCalledWith(1, LENDER_ID, { status: "paid" });

      const all = { amount: 30, description: "Dinner", personName: "Sam", status: "lending" };
      res = await updateTab(request("PATCH", url, all), params("2147483647"));
      expect(res.status).toBe(200);
      expect(tabService.updateTab).toHaveBeenLastCalledWith(2147483647, LENDER_ID, all);
    });

    it.each([
      ["Amount must be positive", 400],
      ["Description cannot be empty", 400],
      ["Person name cannot be empty", 400],
      ["Invalid status value", 400],
      ["You don't have permission to update this tab", 403],
      ["Tab not found", 404],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.updateTab).mockRejectedValueOnce(new Error(message));

      const res = await updateTab(request("PATCH", url, { amount: 5 }), params("1"));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });

    it.each([
      ["a string amount", { amount: "12" }, "Amount must be positive"],
      ["a null amount", { amount: null }, "Amount must be positive"],
      ["a numeric description", { description: 5 }, "Description cannot be empty"],
      ["a null person name", { personName: null }, "Person name cannot be empty"],
      ["a non-string status", { status: 5 }, "Invalid status value"],
    ])("rejects %s with the service's message", async (_label, payload, message) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await updateTab(request("PATCH", url, payload), params("1"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: message });
      expect(tabService.updateTab).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed JSON body", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await updateTab(request("PATCH", url, "{"), params("1"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });
      expect(tabService.updateTab).not.toHaveBeenCalled();
    });

    it("hides unexpected errors behind a 500", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.updateTab).mockRejectedValueOnce(new Error("db down"));

      const res = await updateTab(request("PATCH", url, { amount: 5 }), params("1"));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Internal server error" });
    });
  });

  describe("DELETE /api/tabs/[id]", () => {
    const url = "http://localhost/api/tabs/1";

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await deleteTab(request("DELETE", url), params("1"));

      expect(res.status).toBe(401);
      expect(tabService.deleteTab).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-integer id", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

      const res = await deleteTab(request("DELETE", url), params("1abc"));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid tab ID" });
      expect(tabService.deleteTab).not.toHaveBeenCalled();
    });

    it("deletes the tab", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.deleteTab).mockResolvedValueOnce(undefined);

      const res = await deleteTab(request("DELETE", url), params("7"));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Tab deleted successfully" });
      expect(tabService.deleteTab).toHaveBeenCalledWith(7, LENDER_ID);
    });

    it.each([
      ["You don't have permission to delete this tab", 403],
      ["Tab not found", 404],
    ])("maps the service error %j to %i", async (message, status) => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(tabService.deleteTab).mockRejectedValueOnce(new Error(message));

      const res = await deleteTab(request("DELETE", url), params("1"));

      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: message });
    });
  });
});
