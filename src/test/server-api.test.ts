/**
 * Tests for the server-side API handler logic.
 *
 * We isolate the handler business logic by mocking h3's readBody so tests
 * don't need a live HTTP server or a real h3 event object.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { demoSnapshot, demoInvestigation } from "@/data/demo-fixture";
import { computeImpact } from "@/lib/impact";

// ---------------------------------------------------------------------------
// Mock h3's readBody — controls what "body" the handlers receive
// ---------------------------------------------------------------------------

let _mockBody: unknown = {};

vi.mock("h3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("h3")>();
  return {
    ...actual,
    readBody: vi.fn(async () => _mockBody),
  };
});

function setBody(body: unknown) {
  _mockBody = body;
}

// Minimal fake h3 event — readBody is mocked so the event shape doesn't matter
const fakeEvent = {} as Parameters<(typeof import("h3"))["readBody"]>[0];

// ---------------------------------------------------------------------------
// GET /api/snapshot
// ---------------------------------------------------------------------------

describe("GET /api/snapshot", () => {
  it("returns a ClusterSnapshot matching the demo fixture", async () => {
    vi.resetModules();
    const { default: handler } = await import("../../server/api/snapshot.get");
    const result = await (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent);
    expect(result).toMatchObject({
      cluster: demoSnapshot.cluster,
      namespace: demoSnapshot.namespace,
    });
  });

  it("returns a deep clone — not the same reference as the fixture", async () => {
    vi.resetModules();
    const { default: handler } = await import("../../server/api/snapshot.get");
    const a = await (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent);
    const b = await (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent);
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("includes all nodes and edges from the fixture", async () => {
    vi.resetModules();
    const { default: handler } = await import("../../server/api/snapshot.get");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    expect((result["nodes"] as unknown[]).length).toBe(demoSnapshot.nodes.length);
    expect((result["edges"] as unknown[]).length).toBe(demoSnapshot.edges.length);
  });
});

// ---------------------------------------------------------------------------
// POST /api/impact
// ---------------------------------------------------------------------------

describe("POST /api/impact", () => {
  beforeEach(() => vi.resetModules());

  it("returns an ImpactResult for the known incident", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const { default: handler } = await import("../../server/api/impact.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    const expected = computeImpact(demoSnapshot, "inc-checkout-errors");
    expect(result["incidentId"]).toBe("inc-checkout-errors");
    expect(result["confirmedUnhealthy"]).toEqual(
      expect.arrayContaining(expected.confirmedUnhealthy),
    );
    expect(result["impactedEdgeIds"]).toEqual(expect.arrayContaining(expected.impactedEdgeIds));
  });

  it("confirms only unhealthy nodes", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const { default: handler } = await import("../../server/api/impact.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    const confirmed = (result["confirmedUnhealthy"] as string[]).sort();
    expect(confirmed).toEqual(["pod-1", "pod-2", "svc-checkout"]);
  });

  it("marks degraded and adjacent services as potentially affected, not confirmed", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const { default: handler } = await import("../../server/api/impact.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    const ids = (result["potentiallyAffected"] as { resourceId: string }[]).map(
      (p) => p.resourceId,
    );
    expect(ids).toContain("db-orders");
    expect(ids).toContain("ing-public");
    expect(ids).not.toContain("svc-checkout");
  });

  it("throws 404 for an unknown incidentId", async () => {
    setBody({ incidentId: "does-not-exist" });
    const { default: handler } = await import("../../server/api/impact.post");
    await expect(
      (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 when incidentId field is missing", async () => {
    setBody({ notTheRightField: true });
    const { default: handler } = await import("../../server/api/impact.post");
    await expect(
      (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 when body is not an object", async () => {
    setBody("just a string");
    const { default: handler } = await import("../../server/api/impact.post");
    await expect(
      (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// POST /api/investigate — demo fallback (no GEMINI_API_KEY)
// ---------------------------------------------------------------------------

describe("POST /api/investigate — demo fallback", () => {
  beforeEach(() => {
    delete process.env["GEMINI_API_KEY"];
    vi.resetModules();
  });

  it("returns the deterministic demo investigation for the known incident", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    expect(result["generatedBy"]).toBe("demo");
    expect(result["incidentId"]).toBe("inc-checkout-errors");
    expect(result["summary"]).toBe(demoInvestigation.summary);
  });

  it("throws 404 for an incidentId not present in the snapshot", async () => {
    // The incident lookup fails before the Gemini/demo check, so 404 is correct.
    // The 503 (Gemini unavailable for a known incident with no fixture) would only
    // be reachable if the snapshot contained an incident without a demo investigation.
    setBody({ incidentId: "inc-unknown" });
    const { default: handler } = await import("../../server/api/investigate.post");
    await expect(
      (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 when incidentId is missing", async () => {
    setBody({});
    const { default: handler } = await import("../../server/api/investigate.post");
    await expect(
      (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// POST /api/investigate — Gemini path
// ---------------------------------------------------------------------------

describe("POST /api/investigate — Gemini path", () => {
  const VALID_RESPONSE = {
    summary: "Test summary from Gemini.",
    observedFacts: ["Fact 1.", "Fact 2."],
    possibleCauses: [{ cause: "Root cause A.", confidence: "high" }],
    supportingEvidence: [{ evidenceId: "ev1", note: "Relevant because…" }],
    nextChecks: ["kubectl rollout undo deployment/checkout-api"],
  };

  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-api-key";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env["GEMINI_API_KEY"];
    vi.restoreAllMocks();
  });

  it("returns generatedBy:'gemini' when Gemini responds with valid JSON", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESPONSE) }] } }],
      }),
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    expect(result["generatedBy"]).toBe("gemini");
    expect(result["summary"]).toBe(VALID_RESPONSE.summary);
  });

  it("strips evidence IDs not present in the incident timeline", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const responseWithFakeId = {
      ...VALID_RESPONSE,
      supportingEvidence: [
        { evidenceId: "ev1", note: "Real evidence." },
        { evidenceId: "ev999-hallucinated", note: "This ID doesn't exist." },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(responseWithFakeId) }] } }],
      }),
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    const ids = (result["supportingEvidence"] as { evidenceId: string }[]).map((s) => s.evidenceId);
    expect(ids).toContain("ev1");
    expect(ids).not.toContain("ev999-hallucinated");
  });

  it("falls back to demo fixture when Gemini returns non-JSON", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "This is not JSON at all." }] } }],
      }),
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    // Falls back to demo; does not throw to the client
    expect(result["generatedBy"]).toBe("demo");
  });

  it("falls back to demo fixture when Gemini API returns an error status", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "quota exceeded",
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    expect(result["generatedBy"]).toBe("demo");
  });

  it("falls back to demo fixture when Gemini response is missing required fields", async () => {
    setBody({ incidentId: "inc-checkout-errors" });
    const incompleteResponse = {
      summary: "Only a summary; observedFacts, possibleCauses, nextChecks are absent.",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(incompleteResponse) }] } }],
      }),
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    const result = await (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );
    expect(result["generatedBy"]).toBe("demo");
  });
});

// ---------------------------------------------------------------------------
// POST /api/investigate — model selection
// ---------------------------------------------------------------------------

describe("POST /api/investigate — model selection", () => {
  const VALID_RESPONSE = {
    summary: "Model selection test summary.",
    observedFacts: ["Fact A."],
    possibleCauses: [{ cause: "Cause A.", confidence: "medium" }],
    supportingEvidence: [],
    nextChecks: ["Check A."],
  };

  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-api-key";
    delete process.env["GEMINI_MODEL"];
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_MODEL"];
    vi.restoreAllMocks();
  });

  it("uses gemini-3.5-flash-lite as the default model when GEMINI_MODEL is not set", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESPONSE) }] } }],
        }),
      };
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    await (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent);

    expect(capturedUrl).toContain("gemini-3.5-flash-lite");
    expect(capturedUrl).not.toContain("gemini-2.0-flash");
  });

  it("uses the GEMINI_MODEL env var when it is set", async () => {
    process.env["GEMINI_MODEL"] = "gemini-custom-model";
    setBody({ incidentId: "inc-checkout-errors" });

    let capturedUrl = "";
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_RESPONSE) }] } }],
        }),
      };
    }) as unknown as typeof fetch;

    const { default: handler } = await import("../../server/api/investigate.post");
    await (handler as unknown as (e: unknown) => Promise<unknown>)(fakeEvent);

    expect(capturedUrl).toContain("gemini-custom-model");
    expect(capturedUrl).not.toContain("gemini-3.5-flash-lite");
  });
});

// ---------------------------------------------------------------------------
// POST /api/investigate — retry behavior
// ---------------------------------------------------------------------------

describe("POST /api/investigate — retry behavior", () => {
  /** Minimal valid Gemini response body. */
  const VALID_GEMINI_RESPONSE = {
    summary: "Retry test: root cause identified.",
    observedFacts: ["Pods restarted 3 times after rollout."],
    possibleCauses: [{ cause: "Bad container image.", confidence: "high" as const }],
    supportingEvidence: [],
    nextChecks: ["Run kubectl rollout undo."],
  };

  function makeSuccessFetch() {
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(VALID_GEMINI_RESPONSE) }] } }],
      }),
    };
  }

  function makeErrorFetch(status: number) {
    return {
      ok: false,
      status,
      statusText: `Error ${status}`,
      text: async () => `error ${status}`,
    };
  }

  beforeEach(() => {
    // Clear any ambient key BEFORE resetModules so the fresh import sees only
    // what we explicitly set below.
    delete process.env["GEMINI_API_KEY"];
    vi.resetModules();
    // Install fake timers after resetModules so setTimeout inside the handler
    // is controlled by vitest's clock.
    vi.useFakeTimers();
    process.env["GEMINI_API_KEY"] = "test-api-key";
  });

  afterEach(() => {
    delete process.env["GEMINI_API_KEY"];
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("succeeds on the second attempt after a retryable 503", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorFetch(503)) // attempt 0 — fail
      .mockResolvedValueOnce(makeSuccessFetch()); // attempt 1 — succeed

    const { default: handler } = await import("../../server/api/investigate.post");
    const promise = (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );

    // Advance fake timers to fire the backoff delay between attempts
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result["generatedBy"]).toBe("gemini");
    expect(result["summary"]).toBe(VALID_GEMINI_RESPONSE.summary);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("succeeds on the third attempt after two retryable 429s", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorFetch(429)) // attempt 0
      .mockResolvedValueOnce(makeErrorFetch(429)) // attempt 1
      .mockResolvedValueOnce(makeSuccessFetch()); // attempt 2 — succeed

    const { default: handler } = await import("../../server/api/investigate.post");
    const promise = (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result["generatedBy"]).toBe("gemini");
    expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("falls back to demo after exhausting all retries (503 on every attempt)", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    // 3 failures = 1 initial attempt + 2 retries (GEMINI_MAX_RETRIES = 2)
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeErrorFetch(503))
      .mockResolvedValueOnce(makeErrorFetch(503))
      .mockResolvedValueOnce(makeErrorFetch(503));

    const { default: handler } = await import("../../server/api/investigate.post");
    const promise = (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    // Handler catches the exhausted error and falls through to demo fallback
    expect(result["generatedBy"]).toBe("demo");
    expect(global.fetch).toHaveBeenCalledTimes(3); // All retries exhausted
  });

  it("does not retry a non-retryable 401 and falls back immediately", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorFetch(401));

    const { default: handler } = await import("../../server/api/investigate.post");
    const promise = (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    // 401 is non-retryable — falls back to demo without retrying
    expect(result["generatedBy"]).toBe("demo");
    expect(global.fetch).toHaveBeenCalledTimes(1); // No retries
  });

  it("does not retry a non-retryable 400 and falls back immediately", async () => {
    setBody({ incidentId: "inc-checkout-errors" });

    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorFetch(400));

    const { default: handler } = await import("../../server/api/investigate.post");
    const promise = (handler as unknown as (e: unknown) => Promise<Record<string, unknown>>)(
      fakeEvent,
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result["generatedBy"]).toBe("demo");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
