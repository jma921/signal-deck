import { useCallback, useEffect, useMemo, useState } from "react";
import { useSimulationProduction, type SimulationProviderOptions } from "./simulationProvider";
import type { ProductionActions, ProductionSnapshot, ProductionState } from "./types";

export function useProduction(options: SimulationProviderOptions): ProductionState {
  const fallback = useSimulationProduction(options);
  const [snapshot, setSnapshot] = useState<ProductionSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/production/snapshot")
      .then((res) => res.ok ? res.json() : null)
      .then((value) => {
        if (!cancelled && value) setSnapshot(value as ProductionSnapshot);
      })
      .catch(() => {});

    const source = new EventSource("/api/production/stream");
    source.addEventListener("snapshot", (event) => {
      if (cancelled) return;
      setSnapshot(JSON.parse((event as MessageEvent).data) as ProductionSnapshot);
    });
    source.onerror = () => {
      source.close();
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  const postAction = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return;
    const next = await res.json() as ProductionSnapshot;
    setSnapshot(next);
  }, []);

  const serverActions: ProductionActions = useMemo(() => ({
    setServicePosition: (serviceItemId: string) => {
      void postAction("/api/production/position", { serviceItemId });
    },
    advanceServicePosition: () => {
      void postAction("/api/production/advance");
    },
    retreatServicePosition: () => {
      void postAction("/api/production/retreat");
    },
    enableServiceAutoAdvance: fallback.actions.enableServiceAutoAdvance,
    disableServiceAutoAdvance: fallback.actions.disableServiceAutoAdvance,
  }), [fallback.actions.disableServiceAutoAdvance, fallback.actions.enableServiceAutoAdvance, postAction]);

  return snapshot ? { snapshot, actions: serverActions } : fallback;
}
