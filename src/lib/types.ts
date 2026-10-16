export type ResourceKind = "ingress" | "service" | "deployment" | "pod" | "database" | "cache";
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface ResourceNode {
  id: string;
  name: string;
  kind: ResourceKind;
  namespace: string;
  status: HealthStatus;
  metrics: { label: string; value: string }[];
  labels: Record<string, string>;
  position: { x: number; y: number };
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  protocol: string;
}

export interface ClusterChange {
  id: string;
  time: string;
  actor: string;
  resourceId: string;
  description: string;
}

export interface Evidence {
  id: string;
  time: string;
  source: "deployment" | "logs" | "metrics" | "alert" | "events";
  resourceId: string;
  title: string;
  detail: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3";
  status: "open" | "resolved";
  startedAt: string;
  primaryResourceId: string;
  timeline: Evidence[];
}

export interface ClusterSnapshot {
  cluster: string;
  namespace: string;
  capturedAt: string;
  nodes: ResourceNode[];
  edges: DependencyEdge[];
  changes: ClusterChange[];
  incidents: Incident[];
}

export interface ImpactResult {
  incidentId: string;
  confirmedUnhealthy: string[];
  potentiallyAffected: { resourceId: string; reason: string }[];
  paths: string[][];
  impactedEdgeIds: string[];
}

export interface InvestigationResult {
  incidentId: string;
  generatedBy: "demo" | "gemini";
  summary: string;
  observedFacts: string[];
  possibleCauses: { cause: string; confidence: "high" | "medium" | "low" }[];
  supportingEvidence: { evidenceId: string; note: string }[];
  nextChecks: string[];
}

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };
