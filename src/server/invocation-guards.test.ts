import { describe, expect, it, beforeEach } from "vitest";
import { acquireServiceSlot, assertInvocationRate, resetInvocationGuardsForTests } from "./invocation-guards";

describe("invocation guards", () => {
  beforeEach(() => resetInvocationGuardsForTests());

  it("allows the configured request budget and rejects the next request", () => {
    for (let index = 0; index < 30; index += 1) assertInvocationRate("0xabc");
    expect(() => assertInvocationRate("0xabc")).toThrow("rate limit");
  });

  it("limits concurrent service executions and releases capacity", () => {
    const releases = Array.from({ length: 4 }, () => acquireServiceSlot("svc"));
    expect(() => acquireServiceSlot("svc")).toThrow("capacity");
    releases[0]();
    expect(() => acquireServiceSlot("svc")).not.toThrow();
    releases.forEach((release) => release());
  });
});
