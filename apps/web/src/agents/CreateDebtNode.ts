import { debtService } from "@/services/debt.service";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Define your tools
export const createDebt = tool(
  async ({ userId, amount, description, borrowerId, groupId }) => {
    const debt = await debtService.createDebt({
      lenderId: userId,
      amount,
      description,
      borrowerId,
      groupId,
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
    }),
  }
);
