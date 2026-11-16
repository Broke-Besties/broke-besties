import * as React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandMenu } from "./command-menu";

const { effects, setOpen } = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  setOpen: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof React>()),
  useState: () => [false, setOpen],
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const addEventListener = vi.fn();
const removeEventListener = vi.fn();
vi.stubGlobal("React", React);
vi.stubGlobal("document", { addEventListener, removeEventListener });
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  effects.length = 0;
  vi.clearAllMocks();
});
function mount() {
  CommandMenu();
  const cleanup = effects[0]();
  expect(addEventListener).toHaveBeenCalledWith(
    "keydown",
    expect.any(Function),
  );
  return {
    down: addEventListener.mock.calls[0][1] as (event: Event) => void,
    cleanup,
  };
}
describe("command menu keyboard shortcut", () => {
  it("ignores keydown events without a key instead of crashing", () => {
    const { down } = mount();
    expect(() => down(new Event("keydown"))).not.toThrow();
    expect(setOpen).not.toHaveBeenCalled();
  });
  it.each([
    { key: "k", metaKey: true },
    { key: "K", ctrlKey: true },
  ])("toggles the menu for $key with a shortcut modifier", (properties) => {
    const { down } = mount();
    const event = Object.assign(
      new Event("keydown", { cancelable: true }),
      properties,
    );
    down(event);
    expect(event.defaultPrevented).toBe(true);
    const toggle = setOpen.mock.calls[0][0];
    expect(toggle(false)).toBe(true);
    expect(toggle(true)).toBe(false);
  });
  it("ignores normal typing and other shortcuts, and cleans up its listener", () => {
    const { down, cleanup } = mount();
    down(Object.assign(new Event("keydown"), { key: "k" }));
    down(Object.assign(new Event("keydown"), { key: "j", ctrlKey: true }));
    expect(setOpen).not.toHaveBeenCalled();
    cleanup?.();
    expect(removeEventListener).toHaveBeenCalledWith("keydown", down);
  });
});
