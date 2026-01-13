import { debtService } from "@/services/debt.service";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define your tools
export const createDebt = tool(
  async ({ userId, amount, description, borrowerId, groupId, receiptIds }) => {
    const debt = await debtService.createDebt({
      lenderId: userId,
      amount,
      description,
      borrowerId,
      groupId,
      receiptIds,
    });
    return `Debt created successfully. ${debt}`;
  },
  {
    name: "create_debt",
    description: "Creates a new debt record.",
    schema: z.object({
      userId: z.string().describe("The ID of the user"),
      amount: z.number().describe("The amount of the debt"),
      description: z.string().describe("The description of the debt"),
      borrowerId: z.string().describe("The ID of the borrower"),
      groupId: z.number().describe("The ID of the group"),
      receiptIds: z.array(z.string()).optional().describe("The IDs of the receipts (if any)"),
    }),
  }
);

export const readDebtsFromGroup = tool(
  async ({ userId, groupId }) => {
    const debts = await debtService.getGroupDebts(groupId, userId);

    if (debts.length === 0) {
      return "No debts found in this group.";
    }

    const formattedDebts = debts.map((debt: any, index: number) => {
      const isLender = debt.lenderId === userId;
      const otherParty = isLender ? debt.borrower.email : debt.lender.email;
      const direction = isLender ? "lent to" : "borrowed from";

      return `${index + 1}. $${debt.amount.toFixed(2)} ${direction} ${otherParty}
   Description: ${debt.description || "No description"}
   Status: ${debt.status}
   Created: ${new Date(debt.createdAt).toLocaleDateString()}`;
    }).join("\n\n");

    return `Found ${debts.length} debt(s) in this group:\n\n${formattedDebts}`;
  },
  {
    name: "read_debts_from_group",
    description: "Reads all debts from a group.",
    schema: z.object({
      userId: z.string().describe("The ID of the user"),
      groupId: z.number().describe("The ID of the group"),
    }),
  }
);
