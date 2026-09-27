import { z } from "zod";
import { debtService } from "../services/debt.service";
import { debtTransactionService } from "../services/debt-transaction.service";
import { recurringPaymentService } from "../services/recurring-payment.service";

/**
 * Ready-to-register MCP tool definitions. Every handler is scoped to the
 * authenticated user (`ctx.userId` = Supabase user id = the value the web
 * services key debts on); callers never pass a user/index id themselves.
 */

export interface ToolContext {
  userId: string;
  email?: string;
}

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function fail(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unexpected error");
  }
}

export type ToolRegistration = {
  description: string;
  inputSchema: Record<string, z.ZodType>;
  execute: (args: any, extra: unknown) => Promise<ToolResult>;
};

export type ToolRegistrations = Record<string, ToolRegistration>;

export function buildToolRegistrations(ctx: ToolContext): ToolRegistrations {
  const userId = ctx.userId;

  return {
    list_my_debts: {
      description:
        "List debts between the authenticated user and anyone else. " +
        "`type='lending'` shows money others owe the user, `type='borrowing'` " +
        "shows money the user owes others.",
      inputSchema: {
        type: z
          .enum(["lending", "borrowing"])
          .optional()
          .describe("Filter by which side of the debt the user is on"),
        status: z
          .string()
          .optional()
          .describe("Filter by debt status (e.g. pending, paid)"),
      },
      execute: (args) =>
        run(async () =>
          debtService.getUserDebts(userId, {
            type: args.type ?? null,
            status: args.status ?? null,
          }),
        ),
    },

    get_debt: {
      description:
        "Get the full details of a single debt. The authenticated user must " +
        "be the lender or borrower.",
      inputSchema: {
        debtId: z
          .number()
          .int()
          .positive()
          .describe("ID of the debt to fetch"),
      },
      execute: (args) =>
        run(async () => debtService.getDebtById(args.debtId, userId)),
    },

    create_debt: {
      description:
        "Create a new debt where the authenticated user is the lender and " +
        "`borrowerId` owes them `amount`. The debt starts as `pending` and " +
        "the borrower must approve it in the Broke Besties app.",
      inputSchema: {
        amount: z
          .number()
          .positive()
          .describe("Amount owed"),
        borrowerId: z
          .string()
          .min(1)
          .describe("Supabase user id of the person who owes the debt"),
        description: z
          .string()
          .optional()
          .describe("Optional description, e.g. what the debt is for"),
      },
      execute: (args) =>
        run(async () =>
          debtService.createDebt({
            amount: args.amount,
            description: args.description ?? null,
            lenderId: userId,
            borrowerId: args.borrowerId,
          }),
        ),
    },

    request_debt_payment: {
      description:
        "Request a change on a debt: `drop` (delete the debt), `modify` " +
        "(change amount/description) or `confirm_paid` (mark as paid). " +
        "The other party must approve it before it takes effect.",
      inputSchema: {
        debtId: z.number().int().positive().describe("ID of the debt"),
        type: z.enum(["drop", "modify", "confirm_paid"]),
        proposedAmount: z
          .number()
          .positive()
          .optional()
          .describe("New amount (required for modify unless proposedDescription given)"),
        proposedDescription: z
          .string()
          .optional()
          .describe("New description (required for modify unless proposedAmount given)"),
        reason: z.string().optional().describe("Why the change is requested"),
      },
      execute: (args) =>
        run(async () =>
          debtTransactionService.createTransaction({
            debtId: args.debtId,
            type: args.type,
            requesterId: userId,
            proposedAmount: args.type === "modify" ? args.proposedAmount : undefined,
            proposedDescription:
              args.type === "modify" ? args.proposedDescription : undefined,
            reason: args.reason,
          }),
        ),
    },

    respond_debt_request: {
      description:
        "Approve or reject a pending change (`drop`/`modify`/`confirm_paid`) " +
        "on a debt the authenticated user is party to.",
      inputSchema: {
        transactionId: z
          .number()
          .int()
          .positive()
          .describe("ID of the pending request to respond to"),
        approve: z.boolean().describe("Whether to approve the request"),
      },
      execute: (args) =>
        run(async () =>
          debtTransactionService.respondToTransaction({
            transactionId: args.transactionId,
            userId,
            approve: args.approve,
          }),
        ),
    },

    list_my_recurring_payments: {
      description:
        "List recurring payments the authenticated user is the lender of or a " +
        "borrower on. `frequency` is the interval in days.",
      inputSchema: {
        type: z
          .enum(["lending", "borrowing"])
          .optional()
          .describe("Filter by which side of the payment the user is on"),
        status: z
          .enum(["active", "inactive"])
          .optional()
          .describe("Filter by status"),
      },
      execute: (args) =>
        run(async () =>
          recurringPaymentService.getUserRecurringPayments(userId, {
            type: args.type ?? null,
            status: args.status ?? null,
          }),
        ),
    },

    create_recurring_payment: {
      description:
        "Create a new recurring payment where the authenticated user is the " +
        "lender. `frequency` is the interval in days; every borrower's " +
        "`splitPercentage` must be positive and all of them must sum to 100.",
      inputSchema: {
        amount: z.number().positive().describe("Amount each cycle"),
        frequency: z
          .number()
          .int()
          .min(1)
          .describe("Interval between payments in days (e.g. 30 = monthly-ish)"),
        borrowers: z
          .array(
            z.object({
              userId: z
                .string()
                .min(1)
                .describe("Supabase user id of the borrower"),
              splitPercentage: z
                .number()
                .positive()
                .describe("Their share of the amount, in percent"),
            }),
          )
          .min(1)
          .describe("Everyone who shares the payment and how"),
        description: z.string().optional().describe("What the payment is for"),
      },
      execute: (args) =>
        run(async () =>
          recurringPaymentService.createRecurringPayment({
            amount: args.amount,
            description: args.description ?? null,
            frequency: args.frequency,
            lenderId: userId,
            borrowers: args.borrowers,
          }),
        ),
    },

    toggle_recurring_payment: {
      description:
        "Activate or pause a recurring payment (lender only; flips the " +
        "`active`/`inactive` status).",
      inputSchema: {
        id: z
          .number()
          .int()
          .positive()
          .describe("ID of the recurring payment to toggle"),
      },
      execute: (args) =>
        run(async () => recurringPaymentService.toggleStatus(args.id, userId)),
    },
  };
}
