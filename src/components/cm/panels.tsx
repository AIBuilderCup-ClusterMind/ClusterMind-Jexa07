import { Link } from "@tanstack/react-router";
import { Bell, FileText, GitCommit, Gauge, ListTree, Sparkles, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";
import type { ClusterSnapshot, Evidence, Incident } from "@/lib/types";
import { Button, DemoTag, Panel, StateMessage, StatusBadge, kindIcon } from "./primitives";

const evIcon: Record<Evidence["source"], typeof Bell> = {
  deployment: GitCommit,
  logs: FileText,
  metrics: Gauge,
  alert: Bell,
  events: ListTree,
};

export function NodeDetails({ snapshot }: { snapshot: ClusterSnapshot }) {
  const { selectedNodeId, selectNode } = useWorkspace();
  const node = snapshot.nodes.find((n) => n.id === selectedNodeId);
  if (!node)
    return (
      <StateMessage
        kind="empty"
        title="No resource selected"
        detail="Click a node in the topology to inspect it."
      />
    );
  const Icon = kindIcon[node.kind];
  const deps = snapshot.edges
    .filter((e) => e.source === node.id)
    .map((e) => snapshot.nodes.find((n) => n.id === e.target)!);
  const callers = snapshot.edges
    .filter((e) => e.target === node.id)
    .map((e) => snapshot.nodes.find((n) => n.id === e.source)!);
  return (
    <div className="space-y-4 p-3">
      <div className="flex items-start gap-2">
        <div className="grid size-8 place-items-center rounded-sm bg-background text-primary">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-xs">
            {node.kind} · {node.namespace}
          </p>
          <p className="truncate font-mono text-sm">{node.name}</p>
        </div>
        <button
          aria-label="Clear selection"
          onClick={() => selectNode(null)}
          className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <StatusBadge status={node.status} />
      <dl className="grid grid-cols-2 gap-2">
        {node.metrics.map((m) => (
          <div key={m.label} className="rounded-sm border bg-background px-2 py-1.5">
            <dt className="text-[10px] text-muted-foreground">{m.label}</dt>
            <dd className="font-mono text-sm">{m.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="label-xs mb-1.5">Labels</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(node.labels).map(([k, v]) => (
            <span
              key={k}
              className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
            >
              {k}={v}
            </span>
          ))}
        </div>
      </div>
      <NodeList title="Depends on" nodes={deps} />
      <NodeList title="Called by" nodes={callers} />
    </div>
  );
}

function NodeList({ title, nodes }: { title: string; nodes: ClusterSnapshot["nodes"] }) {
  const { selectNode } = useWorkspace();
  return (
    <div>
      <p className="label-xs mb-1.5">{title}</p>
      {nodes.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-0.5">
          {nodes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => selectNode(n.id)}
                className="flex w-full items-center justify-between rounded-sm px-1.5 py-1 text-left font-mono text-xs hover:bg-accent"
              >
                {n.name}
                <StatusBadge status={n.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IncidentTimeline({
  incident,
  snapshot,
}: {
  incident: Incident;
  snapshot: ClusterSnapshot;
}) {
  const { selectNode, selectedNodeId } = useWorkspace();
  return (
    <ol className="relative space-y-0 p-3">
      {incident.timeline.map((ev, i) => {
        const Icon = evIcon[ev.source];
        const res = snapshot.nodes.find((n) => n.id === ev.resourceId);
        const isAlert = ev.source === "alert";
        return (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < incident.timeline.length - 1 && (
              <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
            )}
            <div
              className={cn(
                "z-10 grid size-6 shrink-0 place-items-center rounded-sm border bg-background",
                isAlert ? "border-critical/50 text-critical" : "text-muted-foreground",
              )}
            >
              <Icon className="size-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{ev.time}</span>
                <span className="label-xs !text-[9px]">{ev.source}</span>
              </div>
              <p className="text-[13px] font-medium">{ev.title}</p>
              <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {ev.detail}
              </p>
              {res && (
                <button
                  onClick={() => selectNode(res.id)}
                  className={cn(
                    "mt-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] hover:border-primary hover:text-primary",
                    selectedNodeId === res.id && "border-primary text-primary",
                  )}
                >
                  {res.name}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ImpactPanel({ snapshot }: { snapshot: ClusterSnapshot }) {
  const { impact, runImpact, selectNode, selectedNodeId } = useWorkspace();
  const name = (id: string) => snapshot.nodes.find((n) => n.id === id)?.name ?? id;
  const action = (
    <Button
      variant="primary"
      onClick={runImpact}
      loading={impact.status === "loading"}
      title="Compute blast radius from dependency graph"
    >
      <Target className="size-3.5" />
      Analyze Impact
    </Button>
  );
  return (
    <Panel
      title="Impact analysis"
      actions={
        impact.status === "success" ? (
          <Button variant="ghost" onClick={runImpact}>
            Re-run
          </Button>
        ) : null
      }
      bodyClassName="overflow-auto"
    >
      {impact.status === "idle" && (
        <StateMessage
          kind="empty"
          title="Blast radius not computed"
          detail="Traverse dependencies from checkout-service to find confirmed and potentially affected components."
          action={<div className="mt-2">{action}</div>}
        />
      )}
      {impact.status === "loading" && (
        <StateMessage kind="loading" title="Traversing dependency graph…" />
      )}
      {impact.status === "error" && (
        <StateMessage
          kind="error"
          title="Impact analysis failed"
          detail={impact.message}
          action={<Button onClick={runImpact}>Retry</Button>}
        />
      )}
      {impact.status === "success" && (
        <div className="space-y-4 p-3">
          <Group
            tone="critical"
            title={`Confirmed unhealthy · ${impact.data.confirmedUnhealthy.length}`}
          >
            {impact.data.confirmedUnhealthy.map((id) => (
              <Row
                key={id}
                active={selectedNodeId === id}
                onClick={() => selectNode(id)}
                name={name(id)}
              />
            ))}
          </Group>
          <Group
            tone="warning"
            title={`Potentially affected · ${impact.data.potentiallyAffected.length}`}
          >
            {impact.data.potentiallyAffected.map((p) => (
              <Row
                key={p.resourceId}
                active={selectedNodeId === p.resourceId}
                onClick={() => selectNode(p.resourceId)}
                name={name(p.resourceId)}
                reason={p.reason}
              />
            ))}
          </Group>
          <div>
            <p className="label-xs mb-1.5">Dependency paths</p>
            <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
              {impact.data.paths.map((p) => (
                <li key={p.join()}>{p.map(name).join("  →  ")}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Group({
  tone,
  title,
  children,
}: {
  tone: "critical" | "warning";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-1.5 font-mono text-[11px] uppercase tracking-wider",
          tone === "critical" ? "text-critical" : "text-warning",
        )}
      >
        {title}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Row({
  name,
  reason,
  active,
  onClick,
}: {
  name: string;
  reason?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full rounded-sm border border-transparent px-2 py-1.5 text-left hover:bg-accent",
          active && "border-primary/50 bg-accent",
        )}
      >
        <p className="font-mono text-xs">{name}</p>
        {reason && <p className="text-[11px] text-muted-foreground">{reason}</p>}
      </button>
    </li>
  );
}

export function InvestigationPanel({
  snapshot,
  compact,
}: {
  snapshot: ClusterSnapshot;
  compact?: boolean;
}) {
  const { investigation: inv, runInvestigation, selectNode } = useWorkspace();
  const incident = snapshot.incidents[0];
  const button = (
    <Button
      variant="primary"
      onClick={runInvestigation}
      loading={inv.status === "loading"}
      title={
        DEMO_MODE
          ? "Uses deterministic sample analysis until Gemini is connected"
          : "Send evidence to Gemini"
      }
    >
      <Sparkles className="size-3.5" />
      Investigate with Gemini
    </Button>
  );
  return (
    <Panel
      title="AI investigation"
      actions={
        inv.status === "success" ? (
          <DemoTag>
            {inv.data.generatedBy === "demo" ? "Demo-generated · not Gemini" : "Gemini"}
          </DemoTag>
        ) : null
      }
      bodyClassName="overflow-auto"
    >
      {inv.status === "idle" && (
        <StateMessage
          kind="empty"
          title="No investigation yet"
          detail={
            DEMO_MODE
              ? "Gemini is not connected. Running this returns a deterministic sample analysis from the demo fixture."
              : "Send incident evidence to Gemini for an explanation."
          }
          action={<div className="mt-2">{button}</div>}
        />
      )}
      {inv.status === "loading" && (
        <StateMessage
          kind="loading"
          title="Correlating evidence…"
          detail="Building sample analysis from the incident timeline."
        />
      )}
      {inv.status === "error" && (
        <StateMessage
          kind="unavailable"
          title="Investigation unavailable"
          detail={inv.message}
          action={<Button onClick={runInvestigation}>Retry</Button>}
        />
      )}
      {inv.status === "success" && (
        <div className={cn("grid gap-5 p-4", !compact && "lg:grid-cols-2")}>
          <Section title="Summary" className={!compact ? "lg:col-span-2" : undefined}>
            <p className="text-[13.5px] leading-relaxed">{inv.data.summary}</p>
          </Section>
          <Section title="Observed facts">
            <ul className="space-y-1.5 text-[13px]">
              {inv.data.observedFacts.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Possible causes">
            <ul className="space-y-2">
              {inv.data.possibleCauses.map((c) => (
                <li key={c.cause} className="flex gap-2 text-[13px]">
                  <span
                    title="Confidence"
                    className={cn(
                      "h-fit shrink-0 rounded-sm border px-1.5 font-mono text-[10px] uppercase",
                      c.confidence === "high"
                        ? "border-critical/40 text-critical"
                        : c.confidence === "medium"
                          ? "border-warning/40 text-warning"
                          : "border-border-strong text-muted-foreground",
                    )}
                  >
                    {c.confidence}
                  </span>
                  {c.cause}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Supporting evidence">
            <ul className="space-y-1.5">
              {inv.data.supportingEvidence.map((s) => {
                const ev = incident?.timeline.find((e) => e.id === s.evidenceId);
                return (
                  <li key={s.evidenceId}>
                    <button
                      onClick={() => ev && selectNode(ev.resourceId)}
                      className="w-full rounded-sm border bg-background px-2 py-1.5 text-left hover:border-primary/60"
                    >
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {ev?.time} · {ev?.source}
                      </p>
                      <p className="text-[12.5px]">{ev?.title}</p>
                      <p className="text-[11.5px] text-muted-foreground">{s.note}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section title="Recommended next checks">
            <ol className="space-y-1.5">
              {inv.data.nextChecks.map((c, i) => (
                <li key={c} className="flex gap-2 text-[12.5px]">
                  <span className="font-mono text-muted-foreground">{i + 1}.</span>
                  <span className={c.startsWith("kubectl") ? "font-mono text-primary" : undefined}>
                    {c}
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
      {compact && inv.status === "success" && (
        <div className="border-t p-3">
          <Link to="/investigation" className="text-xs text-primary hover:underline">
            Open full investigation →
          </Link>
        </div>
      )}
    </Panel>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <h3 className="label-xs mb-2">{title}</h3>
      {children}
    </div>
  );
}
