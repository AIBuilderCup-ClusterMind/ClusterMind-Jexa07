/**
 * POST /api/investigate
 *
 * Body: { incidentId: string }
 *
 * If GEMINI_API_KEY is set, sends the incident timeline and computed impact to
 * Gemini and parses a structured InvestigationResult. Falls back to the
 * deterministic demoInvestigation fixture when the key is absent or the API
 * call fails. Never exposes the API key or raw internal errors to the client.
 *
 * Business logic (Gemini call, retry, validation) lives in
 * server/services/gemini.ts and is shared with the Vite dev middleware.
 */
import { defineEventHandler, readBody, createError } from "h3";
import { demoSnapshot, demoInvestigation } from "../../src/data/demo-fixture";
import { computeImpact } from "../../src/lib/impact";
import type { InvestigationResult, ImpactResult } from "../../src/lib/types";
import { callGemini, DEFAULT_GEMINI_MODEL } from "../services/gemini";

export default defineEventHandler(async (event): Promise<InvestigationResult> => {
  // ------------------------------------------------------------------
  // Request validation
  // ------------------------------------------------------------------
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

  // Compute impact for context used in the Gemini prompt
  let impact: ImpactResult | null = null;
  try {
    impact = computeImpact(snapshot, incidentId);
  } catch {
    // Non-fatal: proceed without impact summary
  }

  // ------------------------------------------------------------------
  // Gemini path — API key is server-side only; never reaches the client
  // ------------------------------------------------------------------
  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey) {
    // Trim guards against Windows CRLF appended to .env values by some loaders.
    const model =
      (process.env["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;
    try {
      return await callGemini(apiKey, model, incidentId, incident.timeline, impact);
    } catch (err) {
      // Log server-side but do not expose details to the client
      console.error("Gemini investigation failed:", err);
      // Fall through to demo fixture
    }
  }

  // ------------------------------------------------------------------
  // Demo fallback — only the pre-baked fixture is available
  // ------------------------------------------------------------------
  if (incidentId !== demoInvestigation.incidentId) {
    throw createError({
      statusCode: 503,
      message: "Gemini is not configured. No sample analysis is available for this incident.",
    });
  }

  return structuredClone(demoInvestigation);
});
