/**
 * Data-access layer.
 *
 * Mode selection (evaluated at build time by Vite):
 *
 *  1. DEMO MODE (default)
 *     VITE_DEMO_MODE is not set to "false".
 *     All calls resolve from the local synthetic fixture without any network
 *     requests. Suitable for local development and offline use.
 *
 *  2. LIVE API MODE — same-origin
 *     VITE_DEMO_MODE=false  AND  VITE_API_BASE_URL is not set.
 *     Requests are sent to /api/* on the same origin as the frontend.
 *     Use this for production deployments where the Nitro server serves both
 *     the frontend and the API.
 *
 *  3. LIVE API MODE — explicit base URL
 *     VITE_DEMO_MODE=false  AND  VITE_API_BASE_URL=https://your-api-host
 *     Requests are sent to the configured base URL. Useful for testing against
 *     a separately deployed backend.
 *
 * Endpoints (unchanged from original contract):
 *   GET  /api/snapshot
 *   POST /api/impact      { incidentId }
 *   POST /api/investigate { incidentId }
 */
import { demoInvestigation, demoSnapshot } from "@/data/demo-fixture";
import { computeImpact } from "@/lib/impact";
import type { ClusterSnapshot, ImpactResult, InvestigationResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mode detection — resolved at Vite build time via import.meta.env
// ---------------------------------------------------------------------------

const _demoFlag = import.meta.env["VITE_DEMO_MODE"] as string | undefined;
const _apiBase = import.meta.env["VITE_API_BASE_URL"] as string | undefined;

/**
 * True when running against the local synthetic fixture (no backend calls).
 * Set VITE_DEMO_MODE=false in your production .env to switch to live API mode.
 */
export const DEMO_MODE = _demoFlag !== "false";

/**
 * Base URL prefix prepended to every API path.
 * Empty string → same-origin (relative URLs, works with Nitro's node-server).
 * Set VITE_API_BASE_URL to override for a separately hosted backend.
 */
const API_BASE = DEMO_MODE ? "" : (_apiBase ?? "");

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchSnapshot(): Promise<ClusterSnapshot> {
  if (DEMO_MODE) {
    await delay(350);
    return structuredClone(demoSnapshot);
  }
  return get<ClusterSnapshot>("/api/snapshot");
}

export async function analyzeImpact(
  snapshot: ClusterSnapshot,
  incidentId: string,
): Promise<ImpactResult> {
  if (DEMO_MODE) {
    await delay(700);
    return computeImpact(snapshot, incidentId);
  }
  return post<ImpactResult>("/api/impact", { incidentId });
}

export async function investigate(incidentId: string): Promise<InvestigationResult> {
  if (DEMO_MODE) {
    await delay(1400);
    if (incidentId !== demoInvestigation.incidentId)
      throw new Error("No sample analysis for this incident.");
    return structuredClone(demoInvestigation);
  }
  return post<InvestigationResult>("/api/investigate", { incidentId });
}
