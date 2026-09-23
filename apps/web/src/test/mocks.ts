import { vi, type Mock } from "vitest";

export type MockModel = {
  findUnique: Mock;
  findFirst: Mock;
  findMany: Mock;
  create: Mock;
  createMany: Mock;
  update: Mock;
  delete: Mock;
};

function model(): MockModel {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

export type MockPrisma = {
  $transaction: Mock;
  user: MockModel;
  debt: MockModel;
  receipt: MockModel;
  group: MockModel;
  groupMember: MockModel;
  groupInvite: MockModel;
  friend: MockModel;
  tab: MockModel;
  alert: MockModel;
  recurringPayment: MockModel;
  recurringPaymentBorrower: MockModel;
  debtTransaction: MockModel;
};

/**
 * Builds a fully mocked PrismaClient.
 *
 * `$transaction` supports both shapes used by the services:
 * - `prisma.$transaction(async (tx) => ...)` runs the callback with a fresh
 *   mock client (like an interactive transaction)
 * - `prisma.$transaction([...])` resolves each promise (like a batch)
 */
export function createMockPrisma(): MockPrisma {
  const build = (): MockPrisma =>
    ({
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === "function") {
          const tx = build() as unknown as Omit<MockPrisma, "$transaction">;
          return await (arg as (tx: unknown) => unknown)(tx);
        }
        if (Array.isArray(arg)) {
          return Promise.all(arg as Promise<unknown>[]);
        }
        return undefined;
      }),
      user: model(),
      debt: model(),
      receipt: model(),
      group: model(),
      groupMember: model(),
      groupInvite: model(),
      friend: model(),
      tab: model(),
      alert: model(),
      recurringPayment: model(),
      recurringPaymentBorrower: model(),
      debtTransaction: model(),
    }) as MockPrisma;

  return build();
}

export const EMAIL_METHODS = [
  "sendGroupInvite",
  "sendInviteAccepted",
  "sendDebtCreated",
  "sendDebtDeleted",
  "sendDebtDeletionRequest",
  "sendDebtModificationRequest",
  "sendFriendRequest",
  "sendFriendRequestAccepted",
  "sendFriendRequestRejected",
  "sendGroupInviteAccepted",
  "sendGroupInviteRejected",
  "sendTabCreated",
  "sendTabMarkedPaid",
  "sendDebtRequestApproved",
  "sendDebtRequestRejected",
  "sendAlertReminder",
  "sendDebtRequestCancelled",
] as const;

export type MockEmailService = Record<(typeof EMAIL_METHODS)[number], Mock>;

/** Builds a mocked emailService singleton (every method resolves successfully). */
export function createMockEmailService(): MockEmailService {
  return EMAIL_METHODS.reduce((acc, method) => {
    acc[method] = vi.fn().mockResolvedValue({ success: true });
    return acc;
  }, {} as MockEmailService);
}

// Standard fixture builders shared by the service tests

export const LENDER_ID = "user-lender";
export const BORROWER_ID = "user-borrower";
export const OUTSIDER_ID = "user-outsider";

export function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LENDER_ID,
    name: "Lender Larry",
    email: "larry@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeDebt(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    amount: 100,
    description: "Dinner",
    status: "pending",
    lenderId: LENDER_ID,
    borrowerId: BORROWER_ID,
    groupId: null,
    alertId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
