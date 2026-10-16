import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { analyzeImpact, fetchSnapshot, investigate } from "@/lib/api";
import type { AsyncState, ClusterSnapshot, ImpactResult, InvestigationResult } from "@/lib/types";

interface Workspace {
  snapshot: AsyncState<ClusterSnapshot>;
  impact: AsyncState<ImpactResult>;
  investigation: AsyncState<InvestigationResult>;
  selectedNodeId: string | null;
  activeIncidentId: string;
  selectNode: (id: string | null) => void;
  refresh: () => void;
  runImpact: () => void;
  runInvestigation: () => void;
}

const Ctx = createContext<Workspace | null>(null);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Unexpected error");

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AsyncState<ClusterSnapshot>>({ status: "loading" });
  const [impact, setImpact] = useState<AsyncState<ImpactResult>>({ status: "idle" });
  const [investigation, setInvestigation] = useState<AsyncState<InvestigationResult>>({
    status: "idle",
  });
  const [selectedNodeId, selectNode] = useState<string | null>(null);
  const activeIncidentId = "inc-checkout-errors";

  const refresh = useCallback(() => {
    setSnapshot({ status: "loading" });
    fetchSnapshot()
      .then((data) => setSnapshot({ status: "success", data }))
      .catch((e) => setSnapshot({ status: "error", message: msg(e) }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runImpact = useCallback(() => {
    if (snapshot.status !== "success") return;
    setImpact({ status: "loading" });
    analyzeImpact(snapshot.data, activeIncidentId)
      .then((data) => setImpact({ status: "success", data }))
      .catch((e) => setImpact({ status: "error", message: msg(e) }));
  }, [snapshot]);

  const runInvestigation = useCallback(() => {
    setInvestigation({ status: "loading" });
    investigate(activeIncidentId)
      .then((data) => setInvestigation({ status: "success", data }))
      .catch((e) => setInvestigation({ status: "error", message: msg(e) }));
  }, []);

  return (
    <Ctx.Provider
      value={{
        snapshot,
        impact,
        investigation,
        selectedNodeId,
        activeIncidentId,
        selectNode,
        refresh,
        runImpact,
        runInvestigation,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}
