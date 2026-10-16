/**
 * GET /api/snapshot
 *
 * Returns the ClusterSnapshot. In this implementation the data comes from the
 * same synthetic demo fixture used by the browser demo mode so the API layer
 * can be exercised end-to-end without a live cluster.
 *
 * Swap `demoSnapshot` for a real Kubernetes API call when connecting to a
 * live cluster. The response shape (ClusterSnapshot) must not change.
 */
import { defineEventHandler } from "h3";
import { demoSnapshot } from "../../src/data/demo-fixture";
import type { ClusterSnapshot } from "../../src/lib/types";

export default defineEventHandler((): ClusterSnapshot => {
  // Return a deep clone so a future in-memory mutation doesn't leak across
  // requests if the module is cached by the runtime.
  return structuredClone(demoSnapshot);
});
