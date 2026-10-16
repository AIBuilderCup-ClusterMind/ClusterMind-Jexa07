# ClusterMind

### AI-Powered Kubernetes Infrastructure Digital Twin

ClusterMind is an AI-assisted infrastructure investigation platform designed to help engineers understand Kubernetes dependencies, assess potential failure impact, and investigate infrastructure incidents using evidence-backed explanations from Google Gemini.

It combines an interactive infrastructure topology, deterministic blast-radius analysis, an incident evidence timeline, and AI-generated investigation reports in a unified operations dashboard.

> **Prototype status:** The current version uses a synthetic Kubernetes cluster and a predefined incident scenario. It does not yet connect to a live Kubernetes cluster. Gemini analyzes the supplied synthetic evidence when the API is available; a deterministic demo fallback keeps the investigation experience usable when it is not.

## Overview

Understanding an infrastructure failure often requires engineers to piece together service dependencies, deployment changes, logs, health events, and other evidence across different tools.

ClusterMind explores a more connected workflow: visualize the infrastructure, identify potentially affected resources, assemble the relevant incident evidence, and use AI to explain plausible causes and recommend what to investigate next.

### Key Features

- **Interactive Infrastructure Topology** — Explore a directed graph of Kubernetes resources and their known dependencies using an interactive graph canvas.
- **Infrastructure Health Overview** — Review resource counts, health states, service metrics, active incidents, recent changes, and discovered resource types.
- **Blast-Radius Analysis** — Traverse the dependency graph to identify confirmed unhealthy resources and potentially affected components.
- **Incident Timeline** — Review deployment events, error logs, health-check failures, connection metrics, and alert events in chronological order.
- **AI-Powered Investigation** — Use Google Gemini to generate a structured incident summary, observed facts, possible causes, supporting evidence references, and recommended next checks.
- **Evidence Validation** — Validate investigation output against the supplied incident evidence and discard references to nonexistent evidence IDs.
- **Resilient AI Integration** — Retry transient Gemini failures with bounded exponential backoff and fall back to a deterministic sample investigation if AI analysis is unavailable.
- **Demo Mode** — Explore the full workflow using a predefined synthetic cluster without requiring live Kubernetes access.

## Application Views

| View | Description |
|---|---|
| **Overview** | Summarizes resource health, active incidents, discovered resources, and recent infrastructure changes. |
| **Topology** | Displays the dependency graph, resource status, relationship paths, and selected-resource details. |
| **Incidents** | Presents the incident timeline, blast-radius visualization, and impact analysis. |
| **Investigation** | Displays the AI investigation report, observed facts, possible causes, evidence references, and recommended next checks. |

## How It Works

ClusterMind demonstrates an incident investigation workflow through a predefined Checkout Service failure scenario.

1. **Load the infrastructure snapshot.** The application loads a synthetic Kubernetes resource graph containing Services, Deployments, Pods, databases, caches, and other resources.
2. **Select an incident.** The user investigates elevated Checkout Service errors following a sample deployment.
3. **Analyze the blast radius.** Deterministic graph traversal identifies confirmed unhealthy resources, potential impacts, and relevant dependency paths.
4. **Collect the evidence.** The investigation uses the incident timeline, including deployment changes, connection timeouts, readiness-probe failures, database connection metrics, and alerts.
5. **Generate an explanation.** Google Gemini interprets the supplied evidence and returns a structured investigation report.
6. **Review the findings.** The engineer examines the observed facts, possible causes, evidence references, and recommended next checks.

The graph algorithm determines the dependency and impact relationships. Gemini explains the supplied evidence; it does not establish unobserved dependencies or prove causation merely because events occurred close together.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, TanStack Start, TanStack Router |
| Topology Visualization | React Flow (`@xyflow/react`) |
| Styling | Tailwind CSS v4, custom ClusterMind components |
| Data Fetching and State | TanStack React Query, React Context |
| Backend and Server Rendering | TanStack Start, Nitro, Node.js |
| API | Server-side HTTP handlers for topology snapshots, impact analysis, and investigation |
| Graph Analysis | TypeScript, deterministic breadth-first search (BFS) |
| Generative AI | Google Gemini API |
| Testing | Vitest, Testing Library |
| Code Quality | ESLint, Prettier |
| Deployment Target | Google Cloud Run |

## Architecture

The application separates the user interface, data access, graph calculations, incident evidence, and server-side AI integration.

```text
                         ClusterMind
                              |
              +---------------+---------------+
              |                               |
        React Frontend                 Server API Layer
              |                               |
      +-------+--------+              +-------+--------+
      |       |        |              |       |        |
   Overview Topology Incidents     Snapshot  Impact  Investigate
      |       |        |              |       |        |
      +-------+--------+              |       |        |
              |                       |    Graph BFS   |
         Investigation                |                 |
              |                       |           Gemini Service
              |                       |                 |
              |                       |       Retry and Validation
              |                       |                 |
              +-----------------------+-----------------+
                                      |
                             Structured Investigation
```

### Repository Structure

```text
ClusterMind-Jexa07/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── API.md
│   └── ARCHITECTURE.md
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   └── robots.txt
├── server/
│   ├── api/
│   │   ├── snapshot.get.ts
│   │   ├── impact.post.ts
│   │   └── investigate.post.ts
│   └── services/
│       └── gemini.ts
├── src/
│   ├── components/
│   │   ├── cm/
│   │   └── ui/
│   ├── data/
│   │   └── demo-fixture.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── impact.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── workspace.tsx
│   ├── routes/
│   ├── test/
│   ├── router.tsx
│   ├── server.ts
│   ├── start.ts
│   └── styles.css
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
├── package-lock.json
├── README.md
├── vite.config.ts
├── vite-plugin-api-dev.ts
└── vitest.config.ts
```

Generated route files, TypeScript configuration, ESLint configuration, and Prettier configuration are also included in the repository.

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- A Google Gemini API key for live AI investigation
- Google Cloud CLI and a Google Cloud project for deployment

### 1. Clone the repository

```bash
git clone https://github.com/AIBuilderCup-ClusterMind/ClusterMind-Jexa07.git
cd ClusterMind-Jexa07
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create a local `.env` file in the project root. You can use `.env.example` as a reference.

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
VITE_DEMO_MODE=false
```

Replace the API key placeholder with your own key from [Google AI Studio](https://aistudio.google.com/apikey).

Keep the `.env` file local. **Never commit your real Gemini API key or expose it through a `VITE_` environment variable.**

The application can also run in frontend demo mode without making backend requests:

```env
VITE_DEMO_MODE=true
```

`VITE_DEMO_MODE` is evaluated during the Vite build. When using live API mode, keep `VITE_API_BASE_URL` unset so that the application can call its server API on the same origin.

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

The application provides four main views:

- `/` — Overview
- `/topology` — Infrastructure topology
- `/incidents` — Incident timeline and impact analysis
- `/investigation` — AI investigation report

### 5. Build and run the production application locally

Create the production build:

```bash
npm run build
```

Then start the built Node.js server:

**PowerShell:**

```powershell
$env:PORT = "4322"
node --env-file=.env .output/server/index.mjs
```

Open `http://localhost:4322` to verify the production application.

## API Reference

The application exposes three primary API endpoints.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/snapshot` | Returns the current cluster snapshot, including resources, dependency edges, changes, and incidents. |
| `POST` | `/api/impact` | Computes the blast radius for a specified incident. |
| `POST` | `/api/investigate` | Generates a structured incident investigation using Gemini, with a deterministic fallback. |

### Request Examples

**Analyze impact**

```json
{
  "incidentId": "inc-checkout-errors"
}
```

**Investigate an incident**

```json
{
  "incidentId": "inc-checkout-errors"
}
```

The investigation response includes:

- `incidentId`
- `generatedBy` — `gemini` or `demo`
- `summary`
- `observedFacts`
- `possibleCauses` with confidence levels
- `supportingEvidence`
- `nextChecks`

For complete request and response specifications, see [`docs/API.md`](docs/API.md).

## Testing and Code Quality

Run the available project checks before submitting changes.

```bash
# Run tests
npm test

# Run lint checks
npm run lint

# Check code formatting
npm run format:check

# Format supported source files
npm run format

# Build for production
npm run build
```

The test suite covers application routing, deterministic impact analysis, API request validation, Gemini model selection, transient-error retries, response validation, evidence-reference checks, and demo fallback behavior.

The repository also includes a GitHub Actions workflow under `.github/workflows/ci.yml` to run the configured checks.

## Deployment to Google Cloud Run

ClusterMind is configured for a Node.js/Nitro production server and can be deployed to Google Cloud Run using source deployment.

### Prerequisites

1. Configure a Google Cloud project with billing enabled.
2. Install and authenticate the Google Cloud CLI.
3. Enable the Cloud Run, Cloud Build, and Secret Manager APIs as needed.
4. Create a Secret Manager secret named `gemini-api-key` containing your Gemini API key.
5. Ensure the Cloud Run runtime service account has permission to access that secret.

### Deploy

Run the following command from the project root, replacing `YOUR_REGION` with your chosen Google Cloud region:

```bash
gcloud run deploy clustermind \
  --source . \
  --region YOUR_REGION \
  --set-build-env-vars VITE_DEMO_MODE=false \
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash-lite \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --allow-unauthenticated
```

The build-time environment variable ensures the frontend uses the live API mode. The API key is supplied to the server at runtime through Secret Manager.

After deployment, verify that the public application loads and that `/api/snapshot`, `/api/impact`, and `/api/investigate` return the expected responses.

Cloud Run usage may incur costs depending on deployment, supporting resources, and traffic. Review the current Google Cloud pricing and applicable free-tier allowances before deployment.

## Security Considerations

- Keep Gemini credentials in server-side environment variables or Google Cloud Secret Manager.
- Never commit `.env` or any file containing secrets.
- Keep `.env.example` free of real credentials.
- Do not send Kubernetes Secrets, API keys, or other sensitive infrastructure data to the model.
- Treat AI-generated causes as hypotheses that require verification.
- Do not execute remediation actions automatically.
- Live Kubernetes discovery and production-cluster access controls are outside the current prototype scope.

## Current Limitations

- Cluster topology and incident evidence are synthetic.
- The application does not currently connect to a live Kubernetes cluster.
- Dependency relationships represent the supplied demo topology rather than complete runtime service discovery.
- Impact results are limited by the completeness and accuracy of the supplied graph.
- AI investigation depends on Gemini API availability and may fall back to the deterministic demo report.
- Authentication, authorization, multi-cluster management, and automated remediation are not implemented.

## Future Improvements

- Live Kubernetes resource discovery through read-only cluster access.
- Confidence-labelled dependency relationships derived from runtime telemetry and Kubernetes configuration.
- Automated correlation of deployments, logs, metrics, and incident timelines.
- Historical incident knowledge and service-ownership context.
- More comprehensive testing with reproducible failure scenarios.
- Secure, approved remediation workflows with audit trails and safeguards.

## Acknowledgements

ClusterMind is built with React, TanStack, React Flow, Tailwind CSS, Nitro, and Google's Gemini API.

The project is a prototype exploring how infrastructure visualization, deterministic graph analysis, and generative AI can work together to make incident investigation easier to understand and verify.