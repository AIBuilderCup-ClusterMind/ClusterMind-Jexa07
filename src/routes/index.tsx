import { createFileRoute, Link } from "@tanstack/react-router";
import { SnapshotGate, PageHeader } from "@/components/cm/SnapshotGate";
import { Panel, StatusBadge, kindIcon } from "@/components/cm/primitives";
import { useWorkspace } from "@/lib/workspace";
import type { HealthStatus, ResourceKind } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — ClusterMind" },
      {
        name: "description",
        content:
          "Service health, discovered resources, incidents and recent changes for your Kubernetes digital twin.",
      },
      { property: "og:title", content: "Overview — ClusterMind" },
      {
        property: "og:description",
        content: "Kubernetes digital twin overview: health, resources, incidents, changes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { selectNode } = useWorkspace();
  return (
    <SnapshotGate>
      {(s) => {
        const count = (st: HealthStatus) => s.nodes.filter((n) => n.status === st).length;
        const kinds = Object.entries(
          s.nodes.reduce<Record<string, number>>(
            (a, n) => ({ ...a, [n.kind]: (a[n.kind] ?? 0) + 1 }),
            {},
          ),
        );
        const open = s.incidents.filter((i) => i.status === "open");
        return (
          <>
            <PageHeader
              title="Overview"
              subtitle={`Snapshot of ${s.cluster}/${s.namespace} · synthetic data`}
            />
            <div className="grid gap-3 px-5 pb-5 lg:grid-cols-4">
              <Stat label="Resources" value={s.nodes.length} />
              <Stat label="Healthy" value={count("healthy")} tone="text-healthy" />
              <Stat label="Degraded" value={count("degraded")} tone="text-warning" />
              <Stat label="Unhealthy" value={count("unhealthy")} tone="text-critical" />

              <Panel title="Service health" className="lg:col-span-2">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="label-xs text-left">
                      <th className="px-3 py-2 font-normal">Resource</th>
                      <th className="font-normal">Kind</th>
                      <th className="font-normal">Key metric</th>
                      <th className="px-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.nodes
                      .filter((n) => n.kind !== "pod")
                      .map((n) => (
                        <tr key={n.id} className="border-t">
                          <td className="px-3 py-2">
                            <Link
                              to="/topology"
                              onClick={() => selectNode(n.id)}
                              className="font-mono text-xs hover:text-primary"
                            >
                              {n.name}
                            </Link>
                          </td>
                          <td className="text-xs text-muted-foreground">{n.kind}</td>
                          <td className="font-mono text-xs">
                            {n.metrics[0]?.label}: {n.metrics[0]?.value}
                          </td>
                          <td className="px-3">
                            <StatusBadge status={n.status} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Panel>

              <div className="flex flex-col gap-3 lg:col-span-2">
                <Panel title={`Active incidents · ${open.length}`}>
                  {open.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No active incidents.</p>
                  ) : (
                    open.map((i) => (
                      <Link
                        key={i.id}
                        to="/incidents"
                        className="flex items-center justify-between gap-3 p-3 hover:bg-accent"
                      >
                        <div>
                          <p className="text-sm font-medium">{i.title}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            started {i.startedAt} · {i.timeline.length} evidence items
                          </p>
                        </div>
                        <span className="rounded-sm border border-critical/40 bg-critical/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-critical">
                          {i.severity}
                        </span>
                      </Link>
                    ))
                  )}
                </Panel>
                <Panel title="Discovered resources">
                  <div className="grid grid-cols-3 gap-px bg-border">
                    {kinds.map(([k, v]) => {
                      const Icon = kindIcon[k as ResourceKind];
                      return (
                        <div key={k} className="flex items-center gap-2 bg-surface p-3">
                          <Icon className="size-4 text-primary" />
                          <span className="text-xs text-muted-foreground">{k}</span>
                          <span className="ml-auto font-mono text-sm">{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </Panel>
                <Panel title="Recent changes">
                  <ul>
                    {s.changes.map((c) => (
                      <li key={c.id} className="flex gap-3 border-t px-3 py-2 first:border-t-0">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {c.time}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px]">{c.description}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            by {c.actor}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          </>
        );
      }}
    </SnapshotGate>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border bg-surface px-4 py-3">
      <p className="label-xs">{label}</p>
      <p className={`mt-1 font-mono text-2xl ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
