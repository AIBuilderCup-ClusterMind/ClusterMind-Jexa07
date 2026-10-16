import { createFileRoute } from "@tanstack/react-router";
import { SnapshotGate, PageHeader } from "@/components/cm/SnapshotGate";
import { TopologyGraph } from "@/components/cm/TopologyGraph";
import { ImpactPanel, IncidentTimeline, InvestigationPanel } from "@/components/cm/panels";
import { Panel, StateMessage } from "@/components/cm/primitives";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents — ClusterMind" },
      {
        name: "description",
        content:
          "Investigate the Checkout Service elevated errors scenario: timeline, blast radius and analysis.",
      },
      { property: "og:title", content: "Incidents — ClusterMind" },
      {
        property: "og:description",
        content: "Incident timeline, blast radius and evidence-backed analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Incidents,
});

function Incidents() {
  const { impact, selectedNodeId, selectNode, activeIncidentId } = useWorkspace();
  return (
    <SnapshotGate>
      {(s) => {
        const incident = s.incidents.find((i) => i.id === activeIncidentId);
        if (!incident)
          return (
            <StateMessage
              kind="empty"
              title="No incidents"
              detail="Nothing is firing in this namespace."
            />
          );
        return (
          <>
            <PageHeader
              title={incident.title}
              subtitle={`${incident.severity.toUpperCase()} · open since ${incident.startedAt} · demo scenario`}
            />
            <div className="grid gap-3 px-5 pb-5 xl:grid-cols-[320px_1fr_340px]">
              <Panel title="Timeline" bodyClassName="overflow-auto">
                <IncidentTimeline incident={incident} snapshot={s} />
              </Panel>
              <Panel title="Blast radius" className="relative min-h-[460px] overflow-hidden">
                <div className="absolute inset-0 top-10">
                  <TopologyGraph
                    snapshot={s}
                    impact={impact.status === "success" ? impact.data : null}
                    selectedId={selectedNodeId}
                    onSelect={selectNode}
                  />
                </div>
              </Panel>
              <ImpactPanel snapshot={s} />
              <div className="xl:col-span-3">
                <InvestigationPanel snapshot={s} />
              </div>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}
