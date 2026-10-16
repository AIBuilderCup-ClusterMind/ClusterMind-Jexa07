/**
 * src/lib/error-reporting.ts
 *
 * Generic client-side error reporting utility.
 *
 * This module forwards boundary-caught errors to any registered error reporter
 * hook exposed on the window object, and provides a safe string serializer for
 * unknown thrown values (Responses, plain objects, strings, etc.).
 *
 * There is intentionally no dependency on any specific error-monitoring service.
 * Integrate your own tool (Sentry, Datadog, etc.) by setting window.__errorReporter
 * before this module runs.
 */

type ErrorReporterHook = {
  captureException?: (error: unknown, context?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    __errorReporter?: ErrorReporterHook;
  }
}

const MAX_SERIALIZED_LENGTH = 2000;

/**
 * Converts an unknown thrown value to a human-readable string.
 * Handles Response objects, Error instances, plain strings and arbitrary objects.
 */
export function describeThrown(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const { message } = (error ?? {}) as { message?: unknown };
  if (typeof message === "string" && message.length > 0) return message;
  try {
    return JSON.stringify(error)?.slice(0, MAX_SERIALIZED_LENGTH) ?? String(error);
  } catch {
    return String(error);
  }
}

/**
 * Reports an error caught by a React error boundary or similar handler.
 * Safe to call from SSR (no-ops when window is not available).
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.__errorReporter?.captureException?.(error, {
    source: "react_error_boundary",
    route: window.location.pathname,
    ...context,
  });
}
