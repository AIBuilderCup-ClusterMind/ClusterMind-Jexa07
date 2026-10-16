import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type { ClusterSnapshot, ImpactResult, ResourceNode } from "@/lib/types";
import { kindIcon, statusDot } from "./primitives";

type Mark = "confirmed" | "potential" | "dim" | "none";
type RNodeData = { resource: ResourceNode; selected: boolean; mark: Mark };

function ResourceNodeView({ data }: NodeProps<Node<RNodeData>>) {
  const { resource: r, selected, mark } = data;
  const Icon = kindIcon[r.kind];
  return (
    <div
      title={`${r.kind}: ${r.name} (${r.status})`}
      className={cn(
        "w-[196px] rounded-md border bg-surface-2 px-2.5 py-2 transition-all",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border-strong",
        mark === "confirmed" && "border-critical/70 bg-critical/10",
        mark === "potential" && "border-dashed border-warning/70 bg-warning/5",
        mark === "dim" && "opacity-35",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-1.5 !border-0 !bg-border-strong"
      />
      <div className="flex items-center gap-2">
        <div className="grid size-6 shrink-0 place-items-center rounded-sm bg-background text-primary">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-xs !text-[9px]">{r.kind}</p>
          <p className="truncate font-mono text-[11.5px] text-foreground">{r.name}</p>
        </div>
        <span
          className={cn("size-2 shrink-0 rounded-full", statusDot[r.status])}
          aria-label={r.status}
        />
      </div>
      <div className="mt-1.5 flex gap-3 border-t pt-1.5">
        {r.metrics.slice(0, 2).map((m) => (
          <div key={m.label} className="min-w-0">
            <p className="text-[9px] text-muted-foreground">{m.label}</p>
            <p className="font-mono text-[11px]">{m.value}</p>
          </div>
        ))}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-1.5 !border-0 !bg-border-strong"
      />
    </div>
  );
}

const nodeTypes = { resource: ResourceNodeView };

export function TopologyGraph({
  snapshot,
  impact,
  selectedId,
  onSelect,
}: {
  snapshot: ClusterSnapshot;
  impact: ImpactResult | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const confirmed = new Set(impact?.confirmedUnhealthy ?? []);
    const potential = new Set(impact?.potentiallyAffected.map((p) => p.resourceId) ?? []);
    const hotEdges = new Set(impact?.impactedEdgeIds ?? []);
    const nodes: Node<RNodeData>[] = snapshot.nodes.map((r) => ({
      id: r.id,
      type: "resource",
      position: r.position,
      data: {
        resource: r,
        selected: r.id === selectedId,
        mark: !impact
          ? "none"
          : confirmed.has(r.id)
            ? "confirmed"
            : potential.has(r.id)
              ? "potential"
              : "dim",
      },
    }));
    const edges: Edge[] = snapshot.edges.map((e) => {
      const hot = hotEdges.has(e.id);
      const color = hot ? "var(--color-critical)" : "var(--color-border-strong)";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.protocol,
        animated: hot,
        style: { stroke: color, strokeWidth: hot ? 1.8 : 1.2, opacity: impact && !hot ? 0.35 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        labelBgPadding: [4, 2] as [number, number],
      };
    });
    return { nodes, edges };
  }, [snapshot, impact, selectedId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
      nodesDraggable
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.3}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
      style={{ background: "transparent" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={22}
        size={1}
        color="var(--color-border-strong)"
      />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  );
}
