import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", async () => {
  return { getUser: vi.fn() };
});
vi.mock("@/services/debt.service", async () => {
  return { debtService: { createDebt: vi.fn(), getUserDebts: vi.fn() } };
});
vi.mock("@/services/user.service", async () => {
  return { userService: { getUserById: vi.fn(), updateUser: vi.fn() } };
});
vi.mock("@/services/alert.service", async () => {
  return {
    alertService: {
      getAlertsDueForReminder: vi.fn(),
      markReminderSent: vi.fn(),
    },
  };
});
vi.mock("@/services/email.service", async () => {
  const { createMockEmailService } = await import("../../test/mocks");
  return { emailService: createMockEmailService() };
});
vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../../test/mocks");
  return { prisma: createMockPrisma() };
});

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { userService } from "@/services/user.service";
import { alertService } from "@/services/alert.service";
import { emailService } from "@/services/email.service";
import { POST as createDebtRoute, GET as listDebtsRoute } from "@/app/api/debts/route";
import { GET as getUserRoute, PATCH as patchUserRoute } from "@/app/api/user/route";
import {
  GET as cronRemindersRoute,
} from "@/app/api/cron/alert-reminders/route";
import { BORROWER_ID, LENDER_ID, MockEmailService } from "../../test/mocks";

const email = emailService as unknown as MockEmailService;

const authUser = {
  id: LENDER_ID,
  email: "larry@x.com",
  name: "Larry",
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("POST /api/debts", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await createDebtRoute(
        jsonRequest("http://localhost/api/debts", { amount: 10 }),
      );

      expect(res.status).toBe(401);
      expect(debtService.createDebt).not.toHaveBeenCalled();
    });

    it("creates a debt and returns 201", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(debtService.createDebt).mockResolvedValueOnce({
        id: 1,
        amount: 20,
      } as never);

      const res = await createDebtRoute(
        jsonRequest("http://localhost/api/debts", {
          amount: 20,
          borrowerId: BORROWER_ID,
        }),
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toBe("Debt created successfully");
      expect(debtService.createDebt).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 20,
          lenderId: LENDER_ID,
          borrowerId: BORROWER_ID,
        }),
      );
    });

    it("maps validation errors to 400 and missing entities to 404", async () => {
      vi.mocked(getUser).mockResolvedValue(authUser as never);

      vi.mocked(debtService.createDebt).mockRejectedValueOnce(
        new Error("Valid amount is required"),
      );
      let res = await createDebtRoute(
        jsonRequest("http://localhost/api/debts", { amount: 0 }),
      );
      expect(res.status).toBe(400);

      vi.mocked(debtService.createDebt).mockRejectedValueOnce(
        new Error("Borrower not found"),
      );
      res = await createDebtRoute(
        jsonRequest("http://localhost/api/debts", { amount: 10 }),
      );
      expect(res.status).toBe(404);

      vi.mocked(debtService.createDebt).mockRejectedValueOnce(new Error("boom"));
      res = await createDebtRoute(
        jsonRequest("http://localhost/api/debts", { amount: 10 }),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/debts", () => {
    it("passes the query filters through to the service", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(debtService.getUserDebts).mockResolvedValueOnce([
        { id: 1 },
      ] as never);

      const res = await listDebtsRoute(
        new NextRequest("http://localhost/api/debts?type=lending&status=pending"),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ debts: [{ id: 1 }] });
      expect(debtService.getUserDebts).toHaveBeenCalledWith(LENDER_ID, {
        type: "lending",
        status: "pending",
      });
    });

    it("returns 401 when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await listDebtsRoute(new NextRequest("http://localhost/api/debts"));

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/user", () => {
    it("returns the current user", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.getUserById).mockResolvedValueOnce({
        ...authUser,
      } as never);

      const res = await getUserRoute();

      expect(res.status).toBe(200);
      expect((await res.json()).user.id).toBe(LENDER_ID);
    });

    it("maps 'User not found' to 404", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.getUserById).mockRejectedValueOnce(
        new Error("User not found"),
      );

      const res = await getUserRoute();

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/user", () => {
    it("returns 401 unauthenticated and 400 for a blank name", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      let res = await patchUserRoute(
        new Request("http://localhost/api/user", {
          method: "PATCH",
          body: JSON.stringify({ name: "x" }),
        }),
      );
      expect(res.status).toBe(401);

      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      res = await patchUserRoute(
        new Request("http://localhost/api/user", {
          method: "PATCH",
          body: JSON.stringify({ name: "  " }),
        }),
      );
      expect(res.status).toBe(400);
      expect(userService.updateUser).not.toHaveBeenCalled();
    });

    it("updates the trimmed name", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
      vi.mocked(userService.updateUser).mockResolvedValueOnce({
        ...authUser,
        name: "Larry H",
      } as never);

      const res = await patchUserRoute(
        new Request("http://localhost/api/user", {
          method: "PATCH",
          body: JSON.stringify({ name: "  Larry H  " }),
        }),
      );

      expect(res.status).toBe(200);
      expect(userService.updateUser).toHaveBeenCalledWith(LENDER_ID, {
        name: "Larry H",
      });
    });
  });

  describe("GET /api/cron/alert-reminders", () => {
    const dueAlert = {
      id: 1,
      message: "Pay up",
      deadline: null,
      borrower: { email: "b@x.com", name: "B" },
      lender: { email: "l@x.com", name: "L" },
      debt: { id: 5, amount: 20, description: "Dinner" },
      recurringPayment: null,
      group: null,
    };

    it("rejects requests without or with the wrong bearer token", async () => {
      vi.stubEnv("CRON_SECRET", "secret");
      let res = await cronRemindersRoute(new NextRequest("http://localhost/api/cron/alert-reminders"));
      expect(res.status).toBe(401);

      res = await cronRemindersRoute(
        new NextRequest("http://localhost/api/cron/alert-reminders", {
          headers: { authorization: "Bearer wrong" },
        }),
      );
      expect(res.status).toBe(401);
      expect(alertService.getAlertsDueForReminder).not.toHaveBeenCalled();
    });

    it("returns 500 when CRON_SECRET is not configured", async () => {
      vi.stubEnv("CRON_SECRET", "");

      const res = await cronRemindersRoute(
        new NextRequest("http://localhost/api/cron/alert-reminders"),
      );

      expect(res.status).toBe(500);
    });

    it("sends reminders for due alerts and marks them sent", async () => {
      vi.stubEnv("CRON_SECRET", "secret");
      vi.mocked(alertService.getAlertsDueForReminder).mockResolvedValueOnce([
        dueAlert,
      ] as never);
      email.sendAlertReminder.mockResolvedValueOnce({ success: true });

      const res = await cronRemindersRoute(
        new NextRequest("http://localhost/api/cron/alert-reminders", {
          headers: { authorization: "Bearer secret" },
        }),
      );

      const body = await res.json();
      expect(body).toEqual({ total: 1, sent: 1, failed: 0, errors: [] });
      expect(email.sendAlertReminder).toHaveBeenCalledWith(
        expect.objectContaining({ to: "b@x.com" }),
      );
      expect(alertService.markReminderSent).toHaveBeenCalledWith(
        1,
        expect.any(Date),
      );
    });

    it("counts failures and does not mark them sent", async () => {
      vi.stubEnv("CRON_SECRET", "secret");
      vi.mocked(alertService.getAlertsDueForReminder).mockResolvedValueOnce([
        dueAlert,
      ] as never);
      email.sendAlertReminder.mockResolvedValueOnce({
        success: false,
        error: "Resend down",
      });

      const res = await cronRemindersRoute(
        new NextRequest("http://localhost/api/cron/alert-reminders", {
          headers: { authorization: "Bearer secret" },
        }),
      );

      const body = await res.json();
      expect(body).toEqual({
        total: 1,
        sent: 0,
        failed: 1,
        errors: [{ alertId: 1, error: "Resend down" }],
      });
      expect(alertService.markReminderSent).not.toHaveBeenCalled();
    });
  });
});
