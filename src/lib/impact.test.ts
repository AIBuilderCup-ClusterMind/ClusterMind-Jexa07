import { describe, expect, it } from "vitest";
import { demoSnapshot } from "@/data/demo-fixture";
import { computeImpact } from "@/lib/impact";

describe("computeImpact", () => {
  const r = computeImpact(demoSnapshot, "inc-checkout-errors");
  it("confirms only unhealthy components", () => {
    expect(r.confirmedUnhealthy.sort()).toEqual(["pod-1", "pod-2", "svc-checkout"]);
  });
  it("marks degraded and adjacent services as potentially affected, not confirmed", () => {
    const ids = r.potentiallyAffected.map((p) => p.resourceId);
    expect(ids).toContain("db-orders");
    expect(ids).toContain("ing-public");
    expect(ids).not.toContain("svc-checkout");
  });
});
