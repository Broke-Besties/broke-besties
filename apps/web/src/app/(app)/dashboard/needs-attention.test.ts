import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { NeedsAttention } from "./needs-attention";
import type { OverdueAlert, PendingTransaction } from "./types";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

const person = { id: "borrower", name: "Alex", email: "alex@example.com" };
const request = (id: number): PendingTransaction => ({
  id,
  type: "modify",
  status: "pending",
  proposedAmount: 15,
  proposedDescription: null,
  reason: null,
  createdAt: "2026-01-01",
  requester: person,
  debt: {
    id,
    amount: 20,
    description: null,
    lender: { id: "lender" },
    borrower: person,
  },
});
const alert = (id: number): OverdueAlert => ({
  id,
  message: null,
  deadline: "2020-01-01",
  isActive: true,
  createdAt: "2020-01-01",
  lender: person,
  debt: { id, amount: 20, description: null, status: "pending" },
  recurringPayment: null,
  group: null,
});
const render = (
  pendingTransactions: PendingTransaction[],
  alerts: OverdueAlert[],
) =>
  renderToStaticMarkup(
    React.createElement(NeedsAttention, {
      pendingTransactions,
      alerts,
      asOf: new Date("2026-11-14").getTime(),
    }),
  );

describe("dashboard attention preview", () => {
  it("bounds large request lists and keeps the full list reachable", () => {
    const html = render(
      Array.from({ length: 18 }, (_, i) => request(i)),
      [],
    );
    expect(html.match(/>Review</g)).toHaveLength(4);
    expect(html).toContain("Showing 4 of 18 items");
    expect(html).toContain('href="/debts/requests"');
    expect(html).toContain("All requests (18)");
  });

  it("keeps overdue debts visible alongside a large approval backlog", () => {
    const html = render(
      Array.from({ length: 10 }, (_, i) => request(i)),
      [alert(1), alert(2), alert(3)],
    );
    expect(html.match(/>Review</g)).toHaveLength(2);
    expect(html.match(/>View debt</g)).toHaveLength(2);
    expect(html).toContain("Showing 4 of 13 items");
    expect(html).toContain('href="/debts/1"');
  });

  it("does not label future, undated, inactive, paid, or missing debts overdue", () => {
    expect(
      render(
        [],
        [
          { ...alert(1), deadline: "2999-01-01" },
          { ...alert(2), deadline: null },
          { ...alert(3), isActive: false },
          { ...alert(4), debt: { ...alert(4).debt!, status: "paid" } },
          { ...alert(5), debt: null },
        ],
      ),
    ).toBe("");
  });

  it("bounds a list consisting only of overdue debts", () => {
    const html = render(
      [],
      Array.from({ length: 12 }, (_, i) => alert(i)),
    );
    expect(html.match(/>View debt</g)).toHaveLength(4);
    expect(html).toContain("Showing 4 of 12 items");
  });
});
