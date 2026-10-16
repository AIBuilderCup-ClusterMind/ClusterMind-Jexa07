import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  AlertTriangle,
  Database,
  Globe,
  Layers,
  Loader2,
  Box,
  Network,
  Zap,
  Inbox,
  CloudOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthStatus, ResourceKind } from "@/lib/types";

export const kindIcon: Record<ResourceKind, typeof Globe> = {
  ingress: Globe,
  service: Network,
  deployment: Layers,
  pod: Box,
  database: Database,
  cache: Zap,
};

const statusStyle: Record<HealthStatus, string> = {
  healthy: "text-healthy border-healthy/30 bg-healthy/10",
  degraded: "text-warning border-warning/30 bg-warning/10",
  unhealthy: "text-critical border-critical/40 bg-critical/10",
  unknown: "text-unknown border-unknown/30 bg-unknown/10",
};
export const statusDot: Record<HealthStatus, string> = {
  healthy: "bg-healthy",
  degraded: "bg-warning",
  unhealthy: "bg-critical",
  unknown: "bg-unknown",
};

export function StatusBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        statusStyle[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {status}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border border-border-strong bg-surface-2 text-foreground hover:bg-accent",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
};

export function Button({
  variant = "secondary",
  loading,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-md border bg-surface", className)}>
      {title && (
        <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
          <h2 className="label-xs">{title}</h2>
          {actions}
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

export function StateMessage({
  kind,
  title,
  detail,
  action,
}: {
  kind: "loading" | "empty" | "error" | "unavailable";
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  const Icon = { loading: Loader2, empty: Inbox, error: AlertTriangle, unavailable: CloudOff }[
    kind
  ];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <Icon
        className={cn(
          "size-5",
          kind === "loading" && "animate-spin text-primary",
          kind === "error" ? "text-critical" : "text-muted-foreground",
        )}
      />
      <p className="text-sm font-medium">{title}</p>
      {detail && <p className="max-w-xs text-xs text-muted-foreground">{detail}</p>}
      {action}
    </div>
  );
}

export function DemoTag({ children = "Demo-generated" }: { children?: ReactNode }) {
  return (
    <span className="rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
      {children}
    </span>
  );
}
