import { useSimulationProduction, type SimulationProviderOptions } from "./simulationProvider";
import type { ProductionState } from "./types";

export function useProduction(options: SimulationProviderOptions): ProductionState {
  return useSimulationProduction(options);
}
