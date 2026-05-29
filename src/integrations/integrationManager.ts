import type { SettingsRepository } from "../runtime/settingsRepository";
import type { IntegrationStatus, IntegrationTestResult } from "./types";
import { ObsManager } from "./obs/obsManager";

export class IntegrationManager {
  private readonly obs: ObsManager;

  constructor(settingsRepository: SettingsRepository) {
    this.obs = new ObsManager(settingsRepository);
  }

  start() {
    this.obs.start();
  }

  stop() {
    this.obs.stop();
  }

  async refresh() {
    await this.obs.refresh();
  }

  getStatuses(): IntegrationStatus[] {
    return [this.obs.getStatus()];
  }

  async reconnectObs(): Promise<IntegrationStatus> {
    return await this.obs.reconnect();
  }

  async testObs(): Promise<IntegrationTestResult> {
    return await this.obs.testConnection();
  }
}
