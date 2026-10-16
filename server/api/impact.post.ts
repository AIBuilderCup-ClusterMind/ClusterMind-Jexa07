/**
 * POST /api/impact
 *
 * Body: { incidentId: string }
 *
 * Validates the request, looks up the incident in the demo snapshot, then
 * runs the same deterministic blast-radius BFS used in browser demo mode.
 * Returns an ImpactResult or a structured error.
 */
import { defineEventHandler, readBody, createError } from "h3";
import { demoSnapshot } from "../../src/data/demo-fixture";
import { computeImpact } from "../../src/lib/impact";
import type { ImpactResult } from "../../src/lib/types";

export default defineEventHandler(async (event): Promise<ImpactResult> => {
  let body: unknown;
  try {
    body = await readBody(event);
  } catch {
    throw createError({ statusCode: 400, message: "Invalid JSON body." });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).incidentId !== "string"
  ) {
    throw createError({
      statusCode: 400,
      message: "Request body must be JSON with a string field 'incidentId'.",
    });
  }

  const { incidentId } = body as { incidentId: string };

  const snapshot = structuredClone(demoSnapshot);
  const incident = snapshot.incidents.find((i) => i.id === incidentId);
  if (!incident) {
    throw createError({
      statusCode: 404,
      message: `Unknown incident: ${incidentId}`,
    });
  }

  return computeImpact(snapshot, incidentId);
});
