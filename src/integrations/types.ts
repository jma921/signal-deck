import type { IntegrationKey } from "../runtime/settings";
import type { ChatMessage, ServiceOrder, SlideState } from "../production/types";

export type IntegrationRuntimeState = "disabled" | "missing-config" | "connecting" | "connected" | "error";

export interface IntegrationStatus {
  integrationKey: IntegrationKey;
  enabled: boolean;
  state: IntegrationRuntimeState;
  message: string | null;
  updatedAt: string;
  resolvedPlanId?: string;
}

export interface IntegrationTestResult {
  ok: boolean;
  status: IntegrationStatus;
}

export interface IntegrationData {
  serviceOrder?: ServiceOrder | null;
  slideState?: SlideState | null;
  chatMessages?: ChatMessage[] | null;
}
