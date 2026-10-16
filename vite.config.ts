/**
 * vite.config.ts
 *
 * ClusterMind — Vite configuration for TanStack Start.
 *
 * Plugin order matters:
 *   1. tanstackStart  — must precede JSX plugins (includes @tanstack/router-plugin)
 *   2. react          — JSX transform & Fast Refresh
 *   3. tailwindcss    — Tailwind CSS v4
 *   4. nitro          — Nitro production server (build-only)
 *   5. apiDevPlugin   — /api/* middleware (serve-only)
 *
 * Production build:
 *   Nitro emits a self-contained Node.js server to .output/server/index.mjs,
 *   suitable for Google Cloud Run.
 *
 *   API handlers are registered explicitly so Nitro picks them up regardless
 *   of the default srcDir scan order.
 *
 * Development:
 *   apiDevPlugin provides the same /api/* endpoints inside the Vite dev server.
 *   The nitro plugin is build-only and does not conflict.
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { apiDevPlugin } from "./vite-plugin-api-dev";

export default defineConfig({
  // Use native tsconfig path resolution (replaces vite-tsconfig-paths plugin)
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // 1. TanStack Start MUST come before React/JSX plugins
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts
      // (our SSR error-capture wrapper). Nitro builds from this entry.
      server: { entry: "server" },
    }),
    // 2. JSX transform
    react(),
    // 3. Tailwind CSS
    tailwindcss(),
    // 4. Nitro production server — build-only
    nitro({
      // Use the Node.js server preset so the production build produces a
      // self-contained Node.js server at .output/server/index.mjs.
      // Required for Google Cloud Run.
      preset: "node-server",
      // Explicitly register the three API route handlers so Nitro picks them
      // up regardless of how TanStack Start configures the default srcDir scan.
      handlers: [
        {
          route: "/api/snapshot",
          method: "get",
          handler: "./server/api/snapshot.get.ts",
        },
        {
          route: "/api/impact",
          method: "post",
          handler: "./server/api/impact.post.ts",
        },
        {
          route: "/api/investigate",
          method: "post",
          handler: "./server/api/investigate.post.ts",
        },
      ],
    }),
    // 5. Dev-only API middleware — activates only when apply === "serve"
    apiDevPlugin(),
  ],
});
