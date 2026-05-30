import type { SettingsRepository } from "../runtime/settingsRepository";
import type { IntegrationData, IntegrationStatus, IntegrationTestResult } from "./types";
import { ObsManager } from "./obs/obsManager";
import { PcoManager } from "./pco/pcoManager";

export class IntegrationManager {
  private readonly obs: ObsManager;
  private readonly pco: PcoManager;

  constructor(settingsRepository: SettingsRepository, private readonly onChange: () => void = () => {}) {
    this.obs = new ObsManager(settingsRepository);
    this.pco = new PcoManager(settingsRepository, onChange);
  }

  start() {
    this.obs.start();
    this.pco.start();
  }

  stop() {
    this.obs.stop();
    this.pco.stop();
  }

  async refresh() {
    await Promise.all([
      this.obs.refresh(),
      this.pco.refresh(),
    ]);
    this.onChange();
  }

  getStatuses(): IntegrationStatus[] {
    return [
      this.pco.getStatus(),
      this.obs.getStatus(),
    ];
  }

  getData(): IntegrationData {
    return {
      serviceOrder: this.pco.getServiceOrder(),
    };
  }

  async reconnectObs(): Promise<IntegrationStatus> {
    return await this.obs.reconnect();
  }

  async testObs(): Promise<IntegrationTestResult> {
    return await this.obs.testConnection();
  }

  async refreshPco(): Promise<IntegrationStatus> {
    return await this.pco.refresh();
  }
}
