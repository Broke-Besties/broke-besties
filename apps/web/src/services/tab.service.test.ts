import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/services/email.service", async () => {
  const { createMockEmailService } = await import("../test/mocks");
  return { emailService: createMockEmailService() };
});

import { prisma } from "@/lib/prisma";
import { emailService } from "@/services/email.service";
import { tabService } from "@/services/tab.service";
import { LENDER_ID, MockEmailService, MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

const base = {
  amount: 25,
  description: "Concert tickets",
  personName: "Mike",
  userId: LENDER_ID,
};

describe("tabService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTab", () => {
    it("validates amount, description, personName and status", async () => {
      await expect(tabService.createTab({ ...base, amount: 0 })).rejects.toThrow(
        "Valid amount is required",
      );
      await expect(tabService.createTab({ ...base, description: "  " })).rejects.toThrow(
        "Description is required",
      );
      await expect(tabService.createTab({ ...base, personName: "" })).rejects.toThrow(
        "Person name is required",
      );
      await expect(
        tabService.createTab({ ...base, status: "weird" as "lending" }),
      ).rejects.toThrow("Invalid status value");
      expect(db.tab.create).not.toHaveBeenCalled();
    });

    it("creates the tab with trimmed fields and emails the user", async () => {
      const created = { id: 1, ...base, description: "Concert tickets", status: "borrowing" };
      db.tab.create.mockResolvedValueOnce(created);
      db.user.findUnique.mockResolvedValueOnce({
        email: "larry@x.com",
        name: "Larry",
      });

      const tab = await tabService.createTab({
        ...base,
        description: "  Concert tickets  ",
        personName: "  Mike  ",
      });

      expect(tab).toEqual(created);
      expect(db.tab.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: "Concert tickets",
            personName: "Mike",
            status: "borrowing",
          }),
        }),
      );
      expect(email.sendTabCreated).toHaveBeenCalledWith(
        expect.objectContaining({ to: "larry@x.com", isLending: false }),
      );
    });

    it("still creates the tab when sending the email fails", async () => {
      db.tab.create.mockResolvedValueOnce({ id: 1, ...base, status: "borrowing" });
      db.user.findUnique.mockRejectedValueOnce(new Error("email down"));

      const tab = await tabService.createTab(base);

      expect(tab.id).toBe(1);
    });
  });

  describe("getTabById", () => {
    it("throws when missing and blocks non-owners", async () => {
      db.tab.findUnique.mockResolvedValueOnce(null);
      await expect(tabService.getTabById(1, LENDER_ID)).rejects.toThrow("Tab not found");

      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID });
      await expect(tabService.getTabById(1, "someone-else")).rejects.toThrow(
        "You don't have permission to view this tab",
      );
    });
  });

  describe("updateTab", () => {
    it("rejects non-owners", async () => {
      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID, status: "borrowing" });

      await expect(
        tabService.updateTab(1, "someone-else", { amount: 5 }),
      ).rejects.toThrow("You don't have permission to update this tab");
    });

    it("validates the updated fields", async () => {
      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID, status: "borrowing" });
      await expect(tabService.updateTab(1, LENDER_ID, { amount: 0 })).rejects.toThrow(
        "Amount must be positive",
      );

      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID, status: "borrowing" });
      await expect(
        tabService.updateTab(1, LENDER_ID, { description: " " }),
      ).rejects.toThrow("Description cannot be empty");

      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID, status: "borrowing" });
      await expect(
        tabService.updateTab(1, LENDER_ID, { status: "weird" }),
      ).rejects.toThrow("Invalid status value");
    });

    it("marks a tab paid and sends the paid email", async () => {
      const existing = { id: 1, userId: LENDER_ID, status: "borrowing", amount: 25, personName: "Mike", description: "Dinner" };
      db.tab.findUnique.mockResolvedValueOnce(existing);
      db.user.findUnique.mockResolvedValueOnce({ email: "larry@x.com", name: "Larry" });
      const updated = { ...existing, status: "paid" };
      db.tab.update.mockResolvedValueOnce(updated);

      const tab = await tabService.updateTab(1, LENDER_ID, { status: "paid" });

      expect(tab.status).toBe("paid");
      expect(email.sendTabMarkedPaid).toHaveBeenCalledWith(
        expect.objectContaining({ to: "larry@x.com", wasLending: false }),
      );
    });

    it("does not email when the tab was already paid", async () => {
      const existing = { id: 1, userId: LENDER_ID, status: "paid", amount: 25 };
      db.tab.findUnique.mockResolvedValueOnce(existing);
      db.tab.update.mockResolvedValueOnce(existing);

      await tabService.updateTab(1, LENDER_ID, { status: "paid" });

      expect(email.sendTabMarkedPaid).not.toHaveBeenCalled();
    });
  });

  describe("deleteTab", () => {
    it("deletes only for the owner", async () => {
      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID });

      await expect(tabService.deleteTab(1, "someone-else")).rejects.toThrow(
        "You don't have permission to delete this tab",
      );

      db.tab.findUnique.mockResolvedValueOnce({ id: 1, userId: LENDER_ID });
      await tabService.deleteTab(1, LENDER_ID);
      expect(db.tab.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
