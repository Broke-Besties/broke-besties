import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import RequestsPageClient from "./requests-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../actions", () => ({ respondToTransaction: vi.fn() }));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

type Transaction = React.ComponentProps<
  typeof RequestsPageClient
>["initialTransactions"][number];
const request = (id: number): Transaction => ({
  id,
  debtId: id,
  type: "modify",
  status: "pending",
  requesterId: "friend",
  lenderApproved: false,
  borrowerApproved: true,
  proposedAmount: 0,
  proposedDescription: "",
  reason: "Discount applied",
  createdAt: "2026-11-14T12:00:00Z",
  requester: { id: "friend", name: "Alex", email: "alex@example.com" },
  debt: {
    id,
    amount: 20,
    description: "Dinner",
    lenderId: "me",
    borrowerId: "friend",
    lender: { id: "me", name: "Daniel", email: "daniel@example.com" },
    borrower: { id: "friend", name: "Alex", email: "alex@example.com" },
    group: { id: 1, name: "Roommates" },
  },
});

describe("requests page", () => {
  it("limits the inbox to five requests and keeps decision details visible", () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestsPageClient, {
        initialTransactions: Array.from({ length: 18 }, (_, i) => request(i)),
        currentUserId: "me",
      }),
    );
    expect(html.match(/data-slot="item"/g) || []).toHaveLength(5);
    expect(html).toContain("of 18 requests");
    expect(html).toContain("Go to next page");
    expect(html).toContain('href="/debts/0/requests/0"');
    expect(html).toContain("Review request");
    expect(html).toContain("Current amount");
    expect(html).toContain("Proposed amount");
    expect(html).toContain("0.00");
    expect(html).toContain("(none)");
    expect(html).toContain("Reason:");
    expect(html).toContain("Roommates");
    expect(html).toContain("Your approval needed");
    expect(html).toContain("Alex: approved");
    expect(html).not.toContain("With Alex");
  });
  it("maps approvals to the current person when they are the borrower", () => {
    const transaction = request(1);
    transaction.lenderApproved = true;
    transaction.borrowerApproved = false;
    const html = renderToStaticMarkup(
      React.createElement(RequestsPageClient, {
        initialTransactions: [transaction],
        currentUserId: "friend",
      }),
    );
    expect(html).toContain("Your approval needed");
    expect(html).toContain("Daniel: approved");
    expect(html).toContain("Requested by you");
  });
  it("shows the empty state without pagination", () => {
    const html = renderToStaticMarkup(
      React.createElement(RequestsPageClient, {
        initialTransactions: [],
        currentUserId: "me",
      }),
    );
    expect(html).toContain("Nothing needs your approval");
    expect(html).not.toContain("Request pages");
  });
});
