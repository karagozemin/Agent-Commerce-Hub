import { describe, expect, it } from "vitest";
import { getPublicActivity, getPublicMetrics } from "./public-metrics";

describe("public metrics", () => {
  it("uses the published catalog and excludes unverified activity", async () => {
    const metrics = await getPublicMetrics();
    expect(metrics.liveServices).toBe(4);
    expect(metrics.mainnetPaidInvocations).toBe(0);
    expect(metrics.uniqueExternalPayers).toBe(0);
    expect(metrics.externalPaymentVolume).toBe("0.00");
    expect(metrics.topServices).toEqual([]);
  });

  it("starts with an empty auditable activity feed", async () => {
    expect(await getPublicActivity()).toEqual([]);
  });
});
