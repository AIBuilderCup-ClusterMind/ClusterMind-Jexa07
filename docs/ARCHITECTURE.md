# ClusterMind — Architecture

## Overview

ClusterMind is a full-stack TypeScript application built on TanStack Start (Vite + Nitro). It provides an interactive Kubernetes topology graph, deterministic blast-radius analysis, and AI-assisted incident investigation via Google Gemini.

## Component Diagram

```mermaid
graph TB
    subgraph Browser["Browser (React 19 / TanStack Router)"]
        UI["UI Components\n(React Flow, Radix, shadcn)"]
        WS["WorkspaceProvider\n(src/lib/workspace.tsx)"]
        API["Data-Access Layer\n(src/lib/api.ts)"]
        IMP["Impact Algorithm\n(src/lib/impact.ts — BFS)"]
    end

    subgraph Server["Node.js / Nitro Server (.output/server)"]
        SN["GET /api/snapshot"]
        SI["POST /api/impact"]
        SV["POST /api/investigate"]
        GS["Gemini Service\n(server/services/gemini.ts)"]
        DEV["Dev Middleware\n(vite-plugin-api-dev.ts)"]
    end

    subgraph External["External"]
        GEMINI["Google Gemini API\ngenerativelanguage.googleapis.com"]
        FIXTURE["Synthetic Fixture\nsrc/data/demo-fixture.ts"]
    end

    UI --> WS --> API
    API -- demo mode --> FIXTURE
    API -- live mode --> SN & SI & SV
    SN --> FIXTURE
    SI --> FIXTURE
    SI --> IMP
    SV --> FIXTURE
    SV --> IMP
    SV --> GS
    GS -- HTTPS --> GEMINI
    GS -- fallback --> FIXTURE
    DEV -.->|dev server only| SN & SI & SV
```

## Data Flow — Incident Investigation

```mermaid
sequenceDiagram
    participant Browser
    participant Handler as POST /api/investigate
    participant Gemini as server/services/gemini.ts
    participant GeminiAPI as Google Gemini API
    participant Fixture as demo-fixture.ts

    Browser->>Handler: { incidentId }
    Handler->>Fixture: demoSnapshot → find incident
    Handler->>Handler: computeImpact(snapshot, incidentId)
    alt GEMINI_API_KEY set
        Handler->>Gemini: callGemini(key, model, incidentId, timeline, impact)
        loop up to 3 attempts (exponential backoff)
            Gemini->>GeminiAPI: POST generateContent
            alt 200 OK
                GeminiAPI-->>Gemini: raw JSON text
                Gemini->>Gemini: parseAndValidateGeminiResponse()
                Gemini-->>Handler: InvestigationResult (generatedBy: "gemini")
            else 5xx / 429 (retryable)
                GeminiAPI-->>Gemini: error status
                Note over Gemini: retry after backoff
            else 4xx (non-retryable)
                GeminiAPI-->>Gemini: error status
                Gemini-->>Handler: throw Error
            end
        end
    end
    alt Gemini unavailable or key absent
        Handler->>Fixture: demoInvestigation
        Handler-->>Browser: InvestigationResult (generatedBy: "demo")
    else Gemini success
        Handler-->>Browser: InvestigationResult (generatedBy: "gemini")
    end
```

## Module Responsibilities

| Module                      | Responsibility                                                  |
| --------------------------- | --------------------------------------------------------------- |
| `src/components/`           | React UI components — render only, no business logic            |
| `src/lib/api.ts`            | Client-side data-access (demo mode / live mode gate)            |
| `src/lib/impact.ts`         | Deterministic BFS blast-radius algorithm                        |
| `src/lib/types.ts`          | Shared TypeScript interfaces used by both client and server     |
| `src/lib/workspace.tsx`     | React context — shared UI state (selected incident, etc.)       |
| `src/data/demo-fixture.ts`  | Synthetic Kubernetes dataset (clearly labelled)                 |
| `server/api/*.ts`           | HTTP request validation; delegates to services                  |
| `server/services/gemini.ts` | Gemini API integration: prompt, retry, validation, fallback     |
| `vite-plugin-api-dev.ts`    | Dev-server middleware; delegates to same services as production |

## Environment Variable Scoping

```
Build time (Vite — baked into client bundle):
  VITE_DEMO_MODE        — enables/disables demo mode
  VITE_API_BASE_URL     — optional API origin override

Server runtime only (never reaches browser):
  GEMINI_API_KEY        — Gemini API key
  GEMINI_MODEL          — Gemini model name
  PORT                  — TCP listen port
```

## Security Properties

- `GEMINI_API_KEY` is never included in client bundles (no `VITE_` prefix).
- The Gemini prompt contains only incident timeline data from the synthetic fixture — never raw Kubernetes Secrets, credentials or sensitive logs.
- Evidence IDs in Gemini responses are validated against the fixture; hallucinated IDs are silently stripped.
- Demo fallback prevents user-visible errors when Gemini is unavailable.
