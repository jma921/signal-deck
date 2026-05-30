import type { IntegrationKey } from "../runtime/settings";
import type { IntegrationStatus } from "./types";

export function nowIso() {
  return new Date().toISOString();
}

export function integrationStatus(
  integrationKey: IntegrationKey,
  state: IntegrationStatus["state"],
  enabled: boolean,
  message: string | null,
): IntegrationStatus {
  return {
    integrationKey,
    enabled,
    state,
    message,
    updatedAt: nowIso(),
  };
}

export function sanitizeError(error: unknown, fallback = "Integration request failed."): string {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}
