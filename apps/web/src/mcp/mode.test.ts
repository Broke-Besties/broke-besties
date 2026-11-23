import { afterEach, describe, expect, it } from "vitest";

import { getAgentMode } from "./mode";

const original = process.env.AGENT_MODE_VERSION;

afterEach(() => {
  if (original === undefined) {
    delete process.env.AGENT_MODE_VERSION;
  } else {
    process.env.AGENT_MODE_VERSION = original;
  }
});

describe("agent mode", () => {
  it("defaults to the LangGraph flow", () => {
    delete process.env.AGENT_MODE_VERSION;
    expect(getAgentMode()).toBe("v1");
  });

  it("uses the MCP flow only for v2", () => {
    process.env.AGENT_MODE_VERSION = "v2";
    expect(getAgentMode()).toBe("v2");

    process.env.AGENT_MODE_VERSION = "v1";
    expect(getAgentMode()).toBe("v1");

    process.env.AGENT_MODE_VERSION = "v3";
    expect(getAgentMode()).toBe("v1");
  });
});
