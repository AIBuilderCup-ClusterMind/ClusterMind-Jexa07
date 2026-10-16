import type { ClusterSnapshot, ImpactResult } from "@/lib/types";

/**
 * Deterministic blast-radius calculation.
 * Confirmed: unhealthy nodes reachable from the incident's primary resource.
 * Potentially affected: upstream callers of confirmed nodes, and degraded downstream dependencies.
 */
export function computeImpact(snapshot: ClusterSnapshot, incidentId: string): ImpactResult {
  const incident = snapshot.incidents.find((i) => i.id === incidentId);
  if (!incident) throw new Error(`Unknown incident ${incidentId}`);
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const e of snapshot.edges) {
    out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
    inc.set(e.target, [...(inc.get(e.target) ?? []), e.source]);
  }

  // Downstream traversal from primary
  const reach = new Set<string>([incident.primaryResourceId]);
  const queue = [incident.primaryResourceId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nxt of out.get(cur) ?? [])
      if (!reach.has(nxt)) {
        reach.add(nxt);
        queue.push(nxt);
      }
  }

  const confirmed = [...reach].filter((id) => byId.get(id)?.status === "unhealthy");
  const confirmedSet = new Set(confirmed);
  const potential = new Map<string, string>();

  for (const id of reach) {
    const n = byId.get(id);
    if (n && !confirmedSet.has(id) && n.status === "degraded")
      potential.set(id, `Degraded and downstream of ${byId.get(incident.primaryResourceId)?.name}`);
  }
  for (const id of confirmed) {
    for (const up of inc.get(id) ?? []) {
      if (!confirmedSet.has(up) && !potential.has(up))
        potential.set(up, `Routes traffic to unhealthy ${byId.get(id)?.name}`);
    }
    for (const down of out.get(id) ?? []) {
      if (!confirmedSet.has(down) && !potential.has(down))
        potential.set(
          down,
          `Called by unhealthy ${byId.get(id)?.name}; may see retries or partial failures`,
        );
    }
  }

  const involved = new Set([...confirmed, ...potential.keys()]);
  const impactedEdges = snapshot.edges.filter(
    (e) => involved.has(e.source) && involved.has(e.target),
  );
  const paths = impactedEdges.map((e) => [e.source, e.target]);

  return {
    incidentId,
    confirmedUnhealthy: confirmed,
    potentiallyAffected: [...potential].map(([resourceId, reason]) => ({ resourceId, reason })),
    paths,
    impactedEdgeIds: impactedEdges.map((e) => e.id),
  };
}
