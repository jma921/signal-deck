import type { IntegrationKey } from "../runtime/settings";

export type IntegrationRuntimeState = "disabled" | "missing-config" | "connecting" | "connected" | "error";

export interface IntegrationStatus {
  integrationKey: IntegrationKey;
  enabled: boolean;
  state: IntegrationRuntimeState;
  message: string | null;
  updatedAt: string;
}

export interface IntegrationTestResult {
  ok: boolean;
  status: IntegrationStatus;
}
