import { START, END, StateGraph } from "@langchain/langgraph";
import { receiptNode } from "./ReceiptNode";
import { z } from "zod";

const ReceiptStateSchema = z.object({
  imageUrl: z.string(),
  rawText: z.string().optional(),
  error: z.string().optional(),
});

export const agent = new StateGraph(ReceiptStateSchema)
  .addNode("parseReceipt", receiptNode)
  .addEdge(START, "parseReceipt")
  .addEdge("parseReceipt", END)
  .compile();

