import type { ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace";
import type { ClusterSnapshot } from "@/lib/types";
import { Button, StateMessage } from "./primitives";

export function SnapshotGate({ children }: { children: (s: ClusterSnapshot) => ReactNode }) {
  const { snapshot, refresh } = useWorkspace();
  if (snapshot.status === "loading" || snapshot.status === "idle")
    return <StateMessage kind="loading" title="Loading cluster snapshot…" />;
  if (snapshot.status === "error")
    return (
      <StateMessage
        kind="error"
        title="Couldn't load cluster snapshot"
        detail={snapshot.message}
        action={<Button onClick={refresh}>Retry</Button>}
      />
    );
  if (snapshot.data.nodes.length === 0)
    return (
      <StateMessage
        kind="empty"
        title="No resources discovered"
        detail="This namespace has no workloads."
      />
    );
  return <>{children(snapshot.data)}</>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
