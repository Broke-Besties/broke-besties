import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
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

  describe("findByEmail", () => {
    it("requires an email and normalizes the lookup", async () => {
      await expect(userService.findByEmail("")).rejects.toThrow(
        "Email parameter is required",
      );

      db.user.findUnique.mockResolvedValueOnce(makeUser());
      const user = await userService.findByEmail(" Larry@Example.com ");
      expect(user?.email).toBe("larry@example.com");
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "larry@example.com" },
      });
    });
  });

  describe("findOrCreatePlaceholderByEmail", () => {
    it("returns an existing user when one is found", async () => {
      const existing = makeUser({ email: "l@x.com" });
      db.user.findUnique.mockResolvedValueOnce(existing);

      const user = await userService.findOrCreatePlaceholderByEmail("l@x.com");

      expect(user).toEqual(existing);
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("creates a signedUp=false placeholder when absent", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);
      const created = makeUser({
        id: "placeholder-id",
        email: "new@x.com",
        name: "new",
        signedUp: false,
      });
      db.user.create.mockResolvedValueOnce(created);

      const user = await userService.findOrCreatePlaceholderByEmail(" New@X.com ");

      expect(user).toEqual(created);
      expect(db.user.create).toHaveBeenCalledWith({
        data: { email: "new@x.com", name: "new", signedUp: false },
      });
    });
  });
});
