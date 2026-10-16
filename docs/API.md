# ClusterMind — API Contract

All endpoints are served by the Nitro node-server in production and by the Vite dev middleware in development. Both share the same request/response types defined in `src/lib/types.ts`.

---

## GET /api/snapshot

Returns the current `ClusterSnapshot` containing all nodes, edges and incidents.

In the current implementation this always returns the **synthetic demo fixture** (`src/data/demo-fixture.ts`). Replace the handler body with a real Kubernetes API call to connect to a live cluster.

### Request

No body required.

### Response — 200 OK

```typescript
interface ClusterSnapshot {
  cluster: string; // Cluster display name
  nodes: ClusterNode[]; // All resources (pods, services, deployments, …)
  edges: ClusterEdge[]; // Directed dependency edges
  incidents: Incident[]; // Active incidents with evidence timelines
}
```

### Errors

| Status | Condition               |
| ------ | ----------------------- |
| 500    | Unexpected server error |

---

## POST /api/impact

Computes the blast radius for a given incident using deterministic BFS.

### Request Body

```json
{ "incidentId": "inc-checkout-errors" }
```

### Response — 200 OK

```typescript
interface ImpactResult {
  incidentId: string;
  confirmedUnhealthy: string[]; // Resource IDs with confirmed errors
  potentiallyAffected: PotentialImpact[]; // Reachable neighbours + reason
}

interface PotentialImpact {
  resourceId: string;
  reason: string;
}
```

### Errors

| Status | Condition                              |
| ------ | -------------------------------------- |
| 400    | Missing or invalid `incidentId` field  |
| 404    | `incidentId` not found in the snapshot |
| 500    | Unexpected server error                |

---

## POST /api/investigate

Performs AI-assisted root-cause investigation for a given incident.

When `GEMINI_API_KEY` is configured: calls the Gemini API, retries on transient errors, validates the response, and returns a live analysis.

When Gemini is unavailable or not configured: falls back to the pre-baked demo investigation fixture (only available for `inc-checkout-errors`).

### Request Body

```json
{ "incidentId": "inc-checkout-errors" }
```

### Response — 200 OK

```typescript
interface InvestigationResult {
  incidentId: string;
  generatedBy: "gemini" | "demo"; // Indicates live vs. fixture response
  summary: string; // One-paragraph root-cause summary
  observedFacts: string[]; // Key facts from the evidence timeline
  possibleCauses: PossibleCause[]; // Ranked hypotheses
  supportingEvidence: SupportingEvidence[]; // Links back to timeline IDs
  nextChecks: string[]; // Actionable remediation steps
}

interface PossibleCause {
  cause: string;
  confidence: "high" | "medium" | "low";
}

interface SupportingEvidence {
  evidenceId: string; // Must match an ID in the incident timeline
  note: string;
}
```

### Errors

| Status | Condition                                                   |
| ------ | ----------------------------------------------------------- |
| 400    | Missing or invalid `incidentId` field                       |
| 404    | `incidentId` not found in the snapshot                      |
| 503    | Gemini not configured and no demo fixture for this incident |
| 500    | Unexpected server error                                     |

### Gemini Behaviour Notes

- Evidence IDs returned by Gemini are validated against the incident timeline; any hallucinated IDs are silently stripped.
- Gemini is given **only** timeline and blast-radius data from the fixture — never raw Kubernetes Secrets, credentials or sensitive logs.
- Retryable errors: `429 Too Many Requests`, `5xx Server Error` (up to 2 retries, 500ms→1s exponential backoff).
- Non-retryable errors: `400 Bad Request`, `401 Unauthorized`, other `4xx`.
