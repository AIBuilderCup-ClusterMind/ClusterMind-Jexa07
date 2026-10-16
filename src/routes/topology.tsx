import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { SnapshotGate, PageHeader } from "@/components/cm/SnapshotGate";
import { TopologyGraph } from "@/components/cm/TopologyGraph";
import { NodeDetails } from "@/components/cm/panels";
import { Button, Panel } from "@/components/cm/primitives";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/topology")({
  head: () => ({
    meta: [
      { title: "Topology — ClusterMind" },
      {
        name: "description",
        content:
          "Interactive dependency graph of ingress, services, deployments, pods and databases.",
      },
      { property: "og:title", content: "Topology — ClusterMind" },
      { property: "og:description", content: "Interactive Kubernetes service dependency graph." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Topology,
});

function Topology() {
  const { impact, runImpact, selectedNodeId, selectNode } = useWorkspace();
  return (
    <SnapshotGate>
      {(s) => (
        <div className="flex h-full flex-col">
          <PageHeader
            title="Topology"
            subtitle="Directed edges show who calls whom. Drag to pan, scroll to zoom."
            actions={
              <Button variant="primary" onClick={runImpact} loading={impact.status === "loading"}>
                <Target className="size-3.5" />
                Analyze Impact
              </Button>
            }
          />
          <div className="grid min-h-[520px] flex-1 gap-3 px-5 pb-5 lg:grid-cols-[1fr_300px]">
            <Panel className="relative overflow-hidden">
              <div className="absolute inset-0">
                <TopologyGraph
                  snapshot={s}
                  impact={impact.status === "success" ? impact.data : null}
                  selectedId={selectedNodeId}
                  onSelect={selectNode}
                />
              </div>
              <Legend showImpact={impact.status === "success"} />
            </Panel>
            <Panel title="Resource details" bodyClassName="overflow-auto">
              <NodeDetails snapshot={s} />
            </Panel>
          </div>
        </div>
      )}
    </SnapshotGate>
  );
}

function Legend({ showImpact }: { showImpact: boolean }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex gap-3 rounded-md border bg-background/90 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <i className="size-1.5 rounded-full bg-healthy" />
        healthy
      </span>
      <span className="flex items-center gap-1">
        <i className="size-1.5 rounded-full bg-warning" />
        degraded
      </span>
      <span className="flex items-center gap-1">
        <i className="size-1.5 rounded-full bg-critical" />
        unhealthy
      </span>
      {showImpact && (
        <span className="flex items-center gap-1 border-l pl-3">
          <i className="size-2 rounded-sm border border-dashed border-warning" />
          potentially affected
        </span>
      )}
    </div>
  );
}
