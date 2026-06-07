import type { SettingsRepository } from "../runtime/settingsRepository";
import type { IntegrationData, IntegrationStatus, IntegrationTestResult } from "./types";
import { ObsManager } from "./obs/obsManager";
import { PcoManager } from "./pco/pcoManager";
import { ProPresenterManager } from "./propresenter/proPresenterManager";
import { SocialStreamManager } from "./socialstream/socialStreamManager";

export class IntegrationManager {
  private readonly obs: ObsManager;
  private readonly pco: PcoManager;
  private readonly propresenter: ProPresenterManager;
  private readonly socialstream: SocialStreamManager;

  constructor(settingsRepository: SettingsRepository, private readonly onChange: () => void = () => {}) {
    this.obs = new ObsManager(settingsRepository);
    this.pco = new PcoManager(settingsRepository, onChange);
    this.propresenter = new ProPresenterManager(settingsRepository, onChange);
    this.socialstream = new SocialStreamManager(settingsRepository, onChange);
  }

  start() {
    this.obs.start();
    this.pco.start();
    this.propresenter.start();
    this.socialstream.start();
  }

  stop() {
    this.obs.stop();
    this.pco.stop();
    this.propresenter.stop();
    this.socialstream.stop();
  }

  async refresh() {
    await Promise.all([
      this.obs.refresh(),
      this.pco.refresh(),
      this.propresenter.refresh(),
      this.socialstream.refresh(),
    ]);
    this.onChange();
  }

  getStatuses(): IntegrationStatus[] {
    return [
      this.pco.getStatus(),
      this.propresenter.getStatus(),
      this.obs.getStatus(),
      this.socialstream.getStatus(),
    ];
  }

  getData(): IntegrationData {
    return {
      serviceOrder: this.pco.getServiceOrder(),
      slideState: this.propresenter.getSlideState(),
      chatMessages: this.socialstream.getChatMessages(),
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
