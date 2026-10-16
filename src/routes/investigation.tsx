import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { SnapshotGate, PageHeader } from "@/components/cm/SnapshotGate";
import { IncidentTimeline, InvestigationPanel } from "@/components/cm/panels";
import { Button, DemoTag, Panel } from "@/components/cm/primitives";
import { DEMO_MODE } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/investigation")({
  head: () => ({
    meta: [
      { title: "Investigation — ClusterMind" },
      {
        name: "description",
        content:
          "Evidence-backed incident explanation: summary, facts, causes, evidence and next checks.",
      },
      { property: "og:title", content: "Investigation — ClusterMind" },
      { property: "og:description", content: "Evidence-backed AI incident investigation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Investigation,
});

function Investigation() {
  const { investigation, runInvestigation, activeIncidentId } = useWorkspace();
  return (
    <SnapshotGate>
      {(s) => {
        const incident = s.incidents.find((i) => i.id === activeIncidentId)!;
        return (
          <>
            <PageHeader
              title="Investigation"
              subtitle={incident.title}
              actions={
                <>
                  {DEMO_MODE && <DemoTag>Gemini not connected</DemoTag>}
                  <Button
                    variant="primary"
                    onClick={runInvestigation}
                    loading={investigation.status === "loading"}
                  >
                    <Sparkles className="size-3.5" />
                    Investigate with Gemini
                  </Button>
                </>
              }
            />
            <div className="grid gap-3 px-5 pb-5 lg:grid-cols-[1fr_320px]">
              <InvestigationPanel snapshot={s} />
              <Panel title="Evidence timeline">
                <IncidentTimeline incident={incident} snapshot={s} />
              </Panel>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}
