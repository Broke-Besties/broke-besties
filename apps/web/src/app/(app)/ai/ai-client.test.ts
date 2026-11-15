import * as React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import AIPageClient from "./ai-client";
import { ReceiptAssignmentPanel } from "./receipt-assignment-panel";
import { InputGroupTextarea } from "@/components/ui/input-group";
import { Select } from "@/components/ui/select";

// Exercise the client handlers with persistent hook state and no real financial writes.
const harness = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  createDebt: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.state)) harness.state[index] = initial;
    return [
      harness.state[index],
      (value: unknown) => {
        harness.state[index] =
          typeof value === "function" ? value(harness.state[index]) : value;
      },
    ];
  },
  useRef: () => ({ current: null }),
  useEffect: () => {},
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("@/app/(app)/groups/[id]/actions", () => ({
  createDebt: harness.createDebt,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.stubGlobal("React", React);
vi.stubGlobal("fetch", harness.fetch);
vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt");
vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Node = React.ReactElement<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
function find(
  node: React.ReactNode,
  predicate: (node: Node) => boolean,
): Node | undefined {
  if (!React.isValidElement(node)) return;
  const element = node as Node;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const match = find(child, predicate);
    if (match) return match;
  }
  return (
    find(element.props.reviewPanel, predicate) ||
    find(element.props.actions, predicate)
  );
}
function render() {
  harness.cursor = 0;
  return AIPageClient();
}
function submit() {
  return find(render(), (node) => node.type === "form")!.props.onSubmit({
    preventDefault() {},
  });
}
const json = (data: unknown, ok = true) => ({ ok, json: async () => data });
const items = [{ id: "coffee", name: "Coffee", price: 6 }];

beforeEach(() => {
  harness.state = [];
  harness.state[4] = "1";
  harness.state[5] = [{ id: 1, name: "Besties" }];
  harness.state[6] = false;
  harness.state[12] = [{ id: "friend", name: "Alex" }];
  vi.clearAllMocks();
});

describe("receipt scanner", () => {
  it("validates uploads and retains a removable preview before scanning", () => {
    const selectFile = (file: File) =>
      find(
        render(),
        (node) => node.type === "input" && node.props.type === "file",
      )!.props.onChange({ target: { files: [file], value: "receipt" } });
    selectFile(new File(["text"], "receipt.txt", { type: "text/plain" }));
    expect(harness.state[3]).toContain("Invalid file type");
    selectFile(new File(["image"], "receipt.png", { type: "image/png" }));
    expect(harness.state[7]).toMatchObject({ url: "blob:receipt" });
    expect(find(render(), (node) => node.type === Select)!.props.disabled).toBe(
      true,
    );
    find(
      render(),
      (node) => node.props["aria-label"] === "Remove receipt",
    )!.props.onClick();
    expect(harness.state[7]).toBeNull();
    expect(harness.fetch).not.toHaveBeenCalled();
  });

  it("scans once, locks the review context, and creates and links only confirmed assignments", async () => {
    harness.state[7] = {
      url: "blob:receipt",
      file: new File(["image"], "receipt.png", { type: "image/png" }),
    };
    let finishParse!: (value: ReturnType<typeof json>) => void;
    harness.fetch
      .mockResolvedValueOnce(
        json({
          data: {
            signedUrl: "https://example.com/receipt.png",
            id: "receipt-1",
          },
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishParse = resolve;
          }),
      );
    const scanning = submit();
    await vi.waitFor(() => expect(finishParse).toBeTypeOf("function"));
    expect(
      find(render(), (node) => node.type === InputGroupTextarea)!.props
        .disabled,
    ).toBe(true);
    await submit();
    expect(harness.fetch).toHaveBeenCalledTimes(2);
    finishParse(json({ data: { items } }));
    await scanning;
    expect(harness.fetch.mock.calls[1][0]).toBe(
      "/api/receipts/receipt-1/parse",
    );
    expect(harness.createDebt).not.toHaveBeenCalled();
    const review = find(
      render(),
      (node) => node.type === ReceiptAssignmentPanel,
    )!;
    expect(review.props.items).toEqual(items);
    expect(find(render(), (node) => node.type === Select)!.props.disabled).toBe(
      true,
    );
    expect(
      find(render(), (node) => node.type === InputGroupTextarea)!.props
        .disabled,
    ).toBe(true);
    harness.createDebt.mockResolvedValue({ success: true, debt: { id: 42 } });
    harness.fetch.mockResolvedValueOnce(json({}));
    await review.props.onCreate([
      { borrowerId: "friend", amount: 6, description: "Coffee" },
    ]);
    expect(harness.createDebt).toHaveBeenCalledWith({
      borrowerId: "friend",
      amount: 6,
      description: "Coffee",
      groupId: 1,
    });
    expect(harness.fetch).toHaveBeenLastCalledWith(
      "/api/receipts/receipt-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ debtIds: [42] }),
      }),
    );
    expect(harness.state[10]).toBeNull();
    expect(harness.state[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupHref: "/groups/1" }),
      ]),
    );
    expect(harness.refresh).toHaveBeenCalled();
  });

  it("cleans up failed scans and lets the user cancel a review without creating debts", async () => {
    harness.state[7] = {
      url: "blob:receipt",
      file: new File(["image"], "receipt.png", { type: "image/png" }),
    };
    harness.fetch
      .mockResolvedValueOnce(
        json({
          data: {
            signedUrl: "https://example.com/receipt.png",
            id: "receipt-1",
          },
        }),
      )
      .mockResolvedValueOnce(json({ error: "Could not read receipt" }, false))
      .mockResolvedValue(json({}));
    await submit();
    expect(harness.state[3]).toBe("Could not read receipt");
    expect(harness.state[14]).toBe(false);
    expect(harness.state[9]).toBeNull();
    expect(harness.fetch).toHaveBeenLastCalledWith("/api/receipts/receipt-1", {
      method: "DELETE",
    });
    harness.state[9] = "receipt-2";
    harness.state[10] = items;
    harness.state[0] = [{ role: "assistant", content: "Review" }];
    await find(
      render(),
      (node) => node.type === ReceiptAssignmentPanel,
    )!.props.onCancel();
    expect(harness.state[10]).toBeNull();
    expect(harness.createDebt).not.toHaveBeenCalled();
    expect(
      find(render(), (node) => node.type === InputGroupTextarea)!.props
        .disabled,
    ).toBe(false);
  });

  it("keeps regular chat context and recovers from an agent error", async () => {
    harness.state[1] = "How can I split dinner?";
    harness.fetch.mockResolvedValueOnce(
      json({ error: "Try again shortly" }, false),
    );
    await submit();
    const request = JSON.parse(harness.fetch.mock.calls[0][1].body);
    expect(request.groupId).toBe(1);
    expect(request.messages).toEqual([
      { type: "human", content: "How can I split dinner?" },
    ]);
    expect(harness.state[3]).toBe("Try again shortly");
    expect(
      find(render(), (node) => node.type === InputGroupTextarea)!.props
        .disabled,
    ).toBe(false);
  });
});
