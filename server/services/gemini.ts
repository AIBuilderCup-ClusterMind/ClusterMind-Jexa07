/**
 * server/services/gemini.ts
 *
 * Shared Gemini integration used by both:
 *  - server/api/investigate.post.ts  (Nitro production handler)
 *  - vite-plugin-api-dev.ts          (Vite dev-server middleware)
 *
 * SECURITY:
 *  - The API key is accepted as a parameter; it is never read from
 *    process.env here so the call site controls where the key comes from.
 *  - Never log the API key or forward raw Kubernetes Secrets to the model.
 *  - Gemini interprets supplied evidence only — it must not invent graph edges
 *    or treat unverified hypotheses as confirmed facts.
 */
import type { Evidence, ImpactResult, InvestigationResult } from "../../src/lib/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default model used when GEMINI_MODEL is not set in the environment. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Maximum number of additional attempts after the first failure (2 = 3 total). */
export const GEMINI_MAX_RETRIES = 2;

const GEMINI_BASE_DELAY_MS = 500;
const GEMINI_MAX_DELAY_MS = 8_000;

// ---------------------------------------------------------------------------
// Retry helpers
// ---------------------------------------------------------------------------

/**
 * Returns true for transient HTTP errors that should be retried.
 * 429 (rate-limit) and 5xx (server-side) are retryable.
 * Other 4xx errors (auth, bad request) are not.
 */
export function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function geminiSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Gemini API types
// ---------------------------------------------------------------------------

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the structured prompt sent to Gemini.
 * Supplies only the provided evidence — never raw cluster credentials.
 */
export function buildGeminiPrompt(
  incidentId: string,
  timeline: Evidence[],
  impact: ImpactResult | null,
): string {
  const timelineText = timeline
    .map((ev) => `- [${ev.time}] (${ev.source}) ${ev.title}: ${ev.detail}`)
    .join("\n");

  const impactText = impact
    ? `Confirmed unhealthy resources: ${impact.confirmedUnhealthy.join(", ")}\nPotentially affected resources: ${impact.potentiallyAffected.map((p) => `${p.resourceId} (${p.reason})`).join(", ")}`
    : "Impact analysis not available.";

  const evidenceIds = timeline.map((ev) => ev.id).join(", ");

  return `You are an SRE incident analysis assistant. Analyse the following Kubernetes incident and return a JSON investigation report.

Incident ID: ${incidentId}

Evidence timeline:
${timelineText}

Blast radius:
${impactText}

Return ONLY a JSON object (no markdown, no prose outside JSON) with this exact shape:
{
  "summary": "<one paragraph summary of the root cause>",
  "observedFacts": ["<fact 1>", "<fact 2>", ...],
  "possibleCauses": [
    { "cause": "<description>", "confidence": "high" | "medium" | "low" },
    ...
  ],
  "supportingEvidence": [
    { "evidenceId": "<one of: ${evidenceIds}>", "note": "<why this evidence is relevant>" },
    ...
  ],
  "nextChecks": ["<actionable check 1>", "<actionable check 2>", ...]
}

Rules:
- Use only the evidence IDs listed above (${evidenceIds}). Do not invent IDs.
- possibleCauses must have at least one entry.
- observedFacts must have at least one entry.
- nextChecks must have at least one entry.
- Do not include markdown fences, comments, or any text outside the JSON object.`;
}

// ---------------------------------------------------------------------------
// Response parsing & validation
// ---------------------------------------------------------------------------

/**
 * Parses the raw Gemini text response and validates the required fields.
 * Strips any evidence IDs the model hallucinated (not present in the timeline).
 * Throws a descriptive Error if validation fails — the caller should fall back
 * to the demo fixture rather than surface parse details to the client.
 */
export function parseAndValidateGeminiResponse(
  raw: string,
  incidentId: string,
  timeline: Evidence[],
): InvestigationResult {
  let parsed: Record<string, unknown>;
  try {
    // Strip optional markdown fences the model may add despite instructions
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${raw.slice(0, 300)}`);
  }

  const validEvidenceIds = new Set(timeline.map((ev) => ev.id));

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) throw new Error("Gemini response missing 'summary'.");

  const observedFacts = toStringArray(parsed.observedFacts);
  if (observedFacts.length === 0) throw new Error("Gemini response missing 'observedFacts'.");

  const possibleCauses = toCauses(parsed.possibleCauses);
  if (possibleCauses.length === 0) throw new Error("Gemini response missing 'possibleCauses'.");

  // Strip any evidence IDs the model hallucinated
  const supportingEvidence = toSupportingEvidence(parsed.supportingEvidence).filter((s) =>
    validEvidenceIds.has(s.evidenceId),
  );

  const nextChecks = toStringArray(parsed.nextChecks);
  if (nextChecks.length === 0) throw new Error("Gemini response missing 'nextChecks'.");

  return {
    incidentId,
    generatedBy: "gemini",
    summary,
    observedFacts,
    possibleCauses,
    supportingEvidence,
    nextChecks,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Calls the Gemini generateContent API with retry / exponential backoff.
 *
 * @param apiKey   Server-side Gemini API key (never log or expose to clients).
 * @param model    Model name, e.g. "gemini-3.5-flash-lite".
 * @param incidentId  Incident being investigated.
 * @param timeline    Evidence items to include in the prompt.
 * @param impact      Optional blast-radius context for the prompt.
 * @returns Validated InvestigationResult with generatedBy: "gemini".
 * @throws  Error on exhausted retries or non-retryable failures.
 */
export async function callGemini(
  apiKey: string,
  model: string,
  incidentId: string,
  timeline: Evidence[],
  impact: ImpactResult | null,
): Promise<InvestigationResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiBody = {
    contents: [
      { role: "user", parts: [{ text: buildGeminiPrompt(incidentId, timeline, impact) }] },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  };

  let lastError: Error = new Error("Gemini call failed after retries");

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delayMs = Math.min(GEMINI_BASE_DELAY_MS * 2 ** (attempt - 1), GEMINI_MAX_DELAY_MS);
      await geminiSleep(delayMs);
    }

    console.log(`[gemini] Attempt ${attempt + 1}/${GEMINI_MAX_RETRIES + 1} — model: "${model}"`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });
    } catch (err) {
      console.error(`[gemini] Attempt ${attempt + 1} — network error:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      const msg = `Gemini API error (${response.status}): ${errText.slice(0, 200)}`;
      const retryable = isRetryableGeminiStatus(response.status);
      console.log(
        `[gemini] HTTP ${response.status} on attempt ${attempt + 1} — model: "${model}" — retryable: ${retryable}`,
      );
      if (!retryable) {
        throw new Error(msg);
      }
      lastError = new Error(msg);
      continue;
    }

    console.log(`[gemini] HTTP 200 on attempt ${attempt + 1} — model: "${model}"`);
    const data = (await response.json()) as GeminiResponse;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // parseAndValidateGeminiResponse throws on invalid output — not retried
    return parseAndValidateGeminiResponse(raw, incidentId, timeline);
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Safe coercion helpers (used by parseAndValidateGeminiResponse)
// ---------------------------------------------------------------------------

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function toCauses(value: unknown): { cause: string; confidence: "high" | "medium" | "low" }[] {
  if (!Array.isArray(value)) return [];
  const VALID = new Set(["high", "medium", "low"]);
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { cause, confidence } = item as Record<string, unknown>;
    if (typeof cause !== "string" || !cause.trim()) return [];
    const conf = VALID.has(String(confidence))
      ? (String(confidence) as "high" | "medium" | "low")
      : "low";
    return [{ cause: cause.trim(), confidence: conf }];
  });
}

function toSupportingEvidence(value: unknown): { evidenceId: string; note: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { evidenceId, note } = item as Record<string, unknown>;
    if (typeof evidenceId !== "string" || !evidenceId.trim()) return [];
    return [{ evidenceId: evidenceId.trim(), note: typeof note === "string" ? note.trim() : "" }];
  });
}
