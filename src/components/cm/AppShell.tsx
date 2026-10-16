import { Link } from "@tanstack/react-router";
import { Activity, LayoutGrid, Network, RefreshCw, Siren, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { DEMO_MODE } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

const nav = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/topology", label: "Topology", icon: Network },
  { to: "/incidents", label: "Incidents", icon: Siren },
  { to: "/investigation", label: "Investigation", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { snapshot, refresh } = useWorkspace();
  const openIncidents =
    snapshot.status === "success"
      ? snapshot.data.incidents.filter((i) => i.status === "open").length
      : 0;
  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <aside className="flex w-14 shrink-0 flex-col border-r bg-surface md:w-52">
        <div className="flex h-12 items-center gap-2 border-b px-3">
          <div className="grid size-7 place-items-center rounded-sm bg-primary/15 text-primary">
            <Activity className="size-4" />
          </div>
          <div className="hidden leading-tight md:block">
            <p className="text-sm font-semibold tracking-tight">ClusterMind</p>
            <p className="font-mono text-[10px] text-muted-foreground">digital twin</p>
          </div>
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              activeOptions={{ exact: to === "/" }}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden flex-1 md:inline">{label}</span>
              {label === "Incidents" && openIncidents > 0 && (
                <span className="hidden rounded-sm bg-critical/15 px-1.5 font-mono text-[10px] text-critical md:inline">
                  {openIncidents}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <p className="hidden border-t p-3 font-mono text-[10px] leading-relaxed text-muted-foreground md:block">
          Synthetic data. No live cluster connected.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
          <Ctx
            label="cluster"
            value={snapshot.status === "success" ? snapshot.data.cluster : "demo-eks"}
          />
          <Ctx
            label="namespace"
            value={snapshot.status === "success" ? snapshot.data.namespace : "payments"}
          />
          <div className="ml-auto flex items-center gap-3">
            {DEMO_MODE && (
              <span
                title="All data and analysis come from a local synthetic fixture"
                className="rounded-sm border border-warning/40 bg-warning/10 px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-warning"
              >
                DEMO MODE
              </span>
            )}
            <button
              onClick={refresh}
              title="Refresh snapshot"
              aria-label="Refresh snapshot"
              className="grid size-8 place-items-center rounded-md border border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RefreshCw
                className={snapshot.status === "loading" ? "size-3.5 animate-spin" : "size-3.5"}
              />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className="label-xs">{label}</span>
      <span className="rounded-sm border bg-surface-2 px-2 py-0.5 font-mono text-xs">{value}</span>
    </div>
  );
}
