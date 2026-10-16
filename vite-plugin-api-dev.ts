/**
 * vite-plugin-api-dev.ts
 *
 * Registers /api/* request handlers inside the Vite dev server so that
 * GET /api/snapshot, POST /api/impact, and POST /api/investigate work during
 * `npm run dev` with exactly the same business logic used in the Nitro
 * production build.
 *
 * In production the Nitro `handlers` array in vite.config.ts covers these
 * routes. This plugin only activates when `apply === "serve"` (dev mode).
 *
 * IMPORTANT: Vite does NOT inject non-VITE_* variables into process.env.
 * Server-side secrets (GEMINI_API_KEY, GEMINI_MODEL) are loaded via Vite's
 * loadEnv() with an empty prefix so all .env variables are available.
 */

import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { callGemini, DEFAULT_GEMINI_MODEL } from "./server/services/gemini";

// ---------------------------------------------------------------------------
// Helper — read the raw request body as a string
// ---------------------------------------------------------------------------
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
export function apiDevPlugin(): Plugin {
  return {
    name: "clustermind-api-dev",
    apply: "serve",

    async configureServer(server) {
      // ---------------------------------------------------------------------------
      // Resolve server-side env vars via Vite's loadEnv().
      //
      // IMPORTANT: Vite does NOT inject non-VITE_ variables into process.env.
      // Reading process.env["GEMINI_MODEL"] here always returns undefined.
      // loadEnv() with an empty prefix reads ALL .env variables correctly.
      // ---------------------------------------------------------------------------
      const rawEnv = loadEnv(server.config.mode, server.config.root, "");

      // Trim values to guard against Windows CRLF appended to .env entries.
      const resolvedApiKey = (rawEnv["GEMINI_API_KEY"] ?? "").trim();
      const resolvedModel =
        (rawEnv["GEMINI_MODEL"] ?? DEFAULT_GEMINI_MODEL).trim() || DEFAULT_GEMINI_MODEL;

      console.log(
        `[api-dev] Gemini config — model: "${resolvedModel}" | key: ${
          resolvedApiKey ? `set (${resolvedApiKey.length} chars)` : "NOT SET"
        }`,
      );

      // Lazy-import the business logic modules (they are TypeScript, so Vite
      // transforms them on demand via ssrLoadModule — no transpile step needed).
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const method = (req.method ?? "GET").toUpperCase();

        // ----------------------------------------------------------------
        // GET /api/snapshot
        // ----------------------------------------------------------------
        if (url === "/api/snapshot" && method === "GET") {
          try {
            const mod = await server.ssrLoadModule("/src/data/demo-fixture.ts");
            const { demoSnapshot } = mod as {
              demoSnapshot: import("./src/lib/types").ClusterSnapshot;
            };
            writeJson(res, 200, structuredClone(demoSnapshot));
          } catch (err) {
            console.error("[api-dev] /api/snapshot error:", err);
            writeJson(res, 500, { statusCode: 500, message: "Internal server error" });
          }
          return;
        }

        // ----------------------------------------------------------------
        // POST /api/impact
        // ----------------------------------------------------------------
        if (url === "/api/impact" && method === "POST") {
          try {
            const rawBody = await readBody(req);
            let body: unknown;
            try {
              body = JSON.parse(rawBody || "null");
            } catch {
              writeJson(res, 400, { statusCode: 400, message: "Invalid JSON body." });
              return;
            }

            if (
              typeof body !== "object" ||
              body === null ||
              typeof (body as Record<string, unknown>).incidentId !== "string"
            ) {
              writeJson(res, 400, {
                statusCode: 400,
                message: "Request body must be JSON with a string field 'incidentId'.",
              });
              return;
            }

            const { incidentId } = body as { incidentId: string };

            const fixtureMod = await server.ssrLoadModule("/src/data/demo-fixture.ts");
            const impactMod = await server.ssrLoadModule("/src/lib/impact.ts");
            const { demoSnapshot } = fixtureMod as {
              demoSnapshot: import("./src/lib/types").ClusterSnapshot;
            };
            const { computeImpact } = impactMod as {
              computeImpact: typeof import("./src/lib/impact").computeImpact;
            };

            const snapshot = structuredClone(demoSnapshot);
            const incident = snapshot.incidents.find((i) => i.id === incidentId);
            if (!incident) {
              writeJson(res, 404, { statusCode: 404, message: `Unknown incident: ${incidentId}` });
              return;
            }

            const result = computeImpact(snapshot, incidentId);
            writeJson(res, 200, result);
          } catch (err) {
            console.error("[api-dev] /api/impact error:", err);
            writeJson(res, 500, { statusCode: 500, message: "Internal server error" });
          }
          return;
        }

        // ----------------------------------------------------------------
        // POST /api/investigate
        // ----------------------------------------------------------------
        if (url === "/api/investigate" && method === "POST") {
          try {
            const rawBody = await readBody(req);
            let body: unknown;
            try {
              body = JSON.parse(rawBody || "null");
            } catch {
              writeJson(res, 400, { statusCode: 400, message: "Invalid JSON body." });
              return;
            }

            if (
              typeof body !== "object" ||
              body === null ||
              typeof (body as Record<string, unknown>).incidentId !== "string"
            ) {
              writeJson(res, 400, {
                statusCode: 400,
                message: "Request body must be JSON with a string field 'incidentId'.",
              });
              return;
            }

            const { incidentId } = body as { incidentId: string };

            const fixtureMod = await server.ssrLoadModule("/src/data/demo-fixture.ts");
            const impactMod = await server.ssrLoadModule("/src/lib/impact.ts");
            const { demoSnapshot, demoInvestigation } = fixtureMod as {
              demoSnapshot: import("./src/lib/types").ClusterSnapshot;
              demoInvestigation: import("./src/lib/types").InvestigationResult;
            };
            const { computeImpact } = impactMod as {
              computeImpact: typeof import("./src/lib/impact").computeImpact;
            };

            const snapshot = structuredClone(demoSnapshot);
            const incident = snapshot.incidents.find((i) => i.id === incidentId);
            if (!incident) {
              writeJson(res, 404, { statusCode: 404, message: `Unknown incident: ${incidentId}` });
              return;
            }

            let impact: import("./src/lib/types").ImpactResult | null = null;
            try {
              impact = computeImpact(snapshot, incidentId);
            } catch {
              // Non-fatal
            }

            // Gemini path — server-side only; key never reaches browser
            if (resolvedApiKey) {
              try {
                const result = await callGemini(
                  resolvedApiKey,
                  resolvedModel,
                  incidentId,
                  incident.timeline,
                  impact,
                );
                writeJson(res, 200, result);
                return;
              } catch (err) {
                console.error("[api-dev] Gemini investigation failed:", err);
                // Fall through to demo fixture
              }
            }

            // Demo fallback
            if (incidentId !== demoInvestigation.incidentId) {
              writeJson(res, 503, {
                statusCode: 503,
                message:
                  "Gemini is not configured. No sample analysis is available for this incident.",
              });
              return;
            }

            writeJson(res, 200, structuredClone(demoInvestigation));
          } catch (err) {
            console.error("[api-dev] /api/investigate error:", err);
            writeJson(res, 500, { statusCode: 500, message: "Internal server error" });
          }
          return;
        }

        // Not an API route — pass through
        next();
      });
    },
  };
}
