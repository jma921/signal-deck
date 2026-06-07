import type { SettingsRepository } from "../../runtime/settingsRepository";
import type { IntegrationSettings } from "../../runtime/settings";
import type { SlideState } from "../../production/types";
import type { IntegrationStatus } from "../types";
import { integrationStatus, sanitizeError } from "../status";

const RECONNECT_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];

function blankSlideState(): SlideState {
  return { presentation: "", currentText: "", currentLabel: "", nextText: "", nextLabel: "", live: false };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

interface ActivePresentation {
  name: string;
  // Slide text → group label ("Verse 1", "Chorus"). The active-presentation
  // payload exposes no per-slide uuid, so slide text is the only join key.
  groupByText: Map<string, string>;
}

// ProPresenter's chunked slide payload nests current/next slide objects, each
// carrying the rendered text. Shapes vary slightly across 7.x builds, so read
// defensively and fall back to "" rather than trusting a fixed structure.
function readSlide(payload: Record<string, unknown>): { current: string; next: string } {
  const current = payload.current as Record<string, unknown> | undefined;
  const next = payload.next as Record<string, unknown> | undefined;
  return {
    current: asText(current?.text),
    next: asText(next?.text),
  };
}

// /v1/presentation/active carries the song name and the ordered groups
// (Verse 1, Chorus, ...), each with its slides' text. We index slide text →
// group name so the live slide/next-slide text can be labelled.
function readActivePresentation(payload: Record<string, unknown>): ActivePresentation {
  const presentation = payload.presentation as Record<string, unknown> | undefined;
  const id = presentation?.id as Record<string, unknown> | undefined;
  const groups = Array.isArray(presentation?.groups) ? presentation!.groups as Record<string, unknown>[] : [];
  const groupByText = new Map<string, string>();
  for (const group of groups) {
    const name = asText(group?.name);
    const slides = Array.isArray(group?.slides) ? group.slides as Record<string, unknown>[] : [];
    for (const slide of slides) {
      const text = asText(slide?.text);
      if (text && !groupByText.has(text)) groupByText.set(text, name);
    }
  }
  return { name: asText(id?.name), groupByText };
}

// The layers payload reports which output layers are active. We only care
// whether the slide layer is showing — that is the honest "ON STAGE" signal.
function readSlideLayerActive(payload: Record<string, unknown>): boolean {
  return payload.slide === true;
}

export class ProPresenterManager {
  private currentStatus: IntegrationStatus = integrationStatus("propresenter", "disabled", false, "ProPresenter integration is disabled.");
  private slideState: SlideState = blankSlideState();
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private running = false;
  private connecting = false;
  private activePresentation: ActivePresentation = { name: "", groupByText: new Map() };
  private loadingPresentation = false;

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly onChange: () => void,
  ) {}

  start() {
    this.running = true;
    void this.refresh();
  }

  stop() {
    this.running = false;
    this.clearReconnectTimer();
    this.disconnect();
    this.reconnectAttempt = 0;
    this.slideState = blankSlideState();
    this.activePresentation = { name: "", groupByText: new Map() };
    this.currentStatus = integrationStatus("propresenter", "disabled", false, "ProPresenter integration stopped.");
  }

  getStatus(): IntegrationStatus {
    return this.currentStatus;
  }

  getSlideState(): SlideState | null {
    return this.currentStatus.state === "connected" ? this.slideState : null;
  }

  async refresh(): Promise<IntegrationStatus> {
    const settings = this.getSettings();

    if (!settings.enabled) {
      this.clearReconnectTimer();
      this.disconnect();
      this.reconnectAttempt = 0;
      this.slideState = blankSlideState();
      this.currentStatus = integrationStatus("propresenter", "disabled", false, "ProPresenter integration is disabled.");
      this.emit();
      return this.currentStatus;
    }

    if (!settings.host || !settings.port) {
      this.clearReconnectTimer();
      this.disconnect();
      this.reconnectAttempt = 0;
      this.currentStatus = integrationStatus("propresenter", "missing-config", true, "ProPresenter host and port are required.");
      this.emit();
      return this.currentStatus;
    }

    this.connect(settings);
    return this.currentStatus;
  }

  private connect(settings: IntegrationSettings) {
    if (!this.running || this.connecting) return;

    this.connecting = true;
    this.disconnect();
    this.currentStatus = integrationStatus("propresenter", "connecting", true, "Connecting to ProPresenter...");
    this.emit();

    const controller = new AbortController();
    this.abortController = controller;
    const baseUrl = `http://${settings.host}:${settings.port}`;

    // Seed the song name + group labels up front; the slide stream refreshes
    // them lazily whenever it sees a slide that isn't in the current song.
    void this.loadActivePresentation(controller, baseUrl);

    void this.streamStatus(controller, `${baseUrl}/v1/status/slide?chunked=true`, (payload) => {
      const { current, next } = readSlide(payload);
      this.slideState = { ...this.slideState, currentText: current, nextText: next };
      // An unknown current slide means the song changed — reload, then relabel.
      if (current && !this.activePresentation.groupByText.has(current)) {
        void this.loadActivePresentation(controller, baseUrl);
      }
      this.applyLabels();
      this.markConnected();
      this.emit();
    });

    // The layers stream only emits on change, not on connect, so seed the live
    // indicator once up front; the stream then keeps it current.
    void this.seedLayers(controller, `${baseUrl}/v1/status/layers`);

    void this.streamStatus(controller, `${baseUrl}/v1/status/layers?chunked=true`, (payload) => {
      this.slideState = { ...this.slideState, live: readSlideLayerActive(payload) };
      this.markConnected();
      this.emit();
    });

    this.connecting = false;
  }

  private async seedLayers(controller: AbortController, url: string) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return;
      const payload = await res.json() as Record<string, unknown>;
      if (this.abortController !== controller) return;
      this.slideState = { ...this.slideState, live: readSlideLayerActive(payload) };
      this.emit();
    } catch {
      // Seeding is best-effort; the chunked stream still drives subsequent updates.
    }
  }

  private async loadActivePresentation(controller: AbortController, baseUrl: string) {
    if (this.loadingPresentation) return;
    this.loadingPresentation = true;
    try {
      const res = await fetch(`${baseUrl}/v1/presentation/active`, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return;
      const payload = await res.json() as Record<string, unknown>;
      if (this.abortController !== controller) return;
      this.activePresentation = readActivePresentation(payload);
      this.applyLabels();
      this.emit();
    } catch {
      // Labels are best-effort; slide text still renders without them.
    } finally {
      this.loadingPresentation = false;
    }
  }

  private applyLabels() {
    const groups = this.activePresentation.groupByText;
    this.slideState = {
      ...this.slideState,
      presentation: this.activePresentation.name || this.slideState.presentation,
      currentLabel: groups.get(this.slideState.currentText) ?? "",
      nextLabel: groups.get(this.slideState.nextText) ?? "",
    };
  }

  // Opens one chunked HTTP stream and dispatches each newline-delimited JSON
  // object to `onPayload`. Returns when the stream ends, errors, or is aborted,
  // scheduling a reconnect unless we were aborted on purpose.
  private async streamStatus(controller: AbortController, url: string, onPayload: (payload: Record<string, unknown>) => void) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`ProPresenter returned ${res.status}.`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          try {
            onPayload(JSON.parse(line) as Record<string, unknown>);
          } catch {
            // Ignore malformed lines; ProPresenter may send keep-alive noise.
          }
        }
      }

      this.handleStreamEnd(controller, "ProPresenter stream closed.");
    } catch (error) {
      if (controller.signal.aborted) return;
      this.handleStreamEnd(controller, sanitizeError(error, "ProPresenter stream failed."));
    }
  }

  private markConnected() {
    if (this.currentStatus.state === "connected") return;
    this.reconnectAttempt = 0;
    this.currentStatus = integrationStatus("propresenter", "connected", true, "Connected to ProPresenter.");
  }

  private handleStreamEnd(controller: AbortController, message: string) {
    if (!this.running || this.abortController !== controller) return;
    this.currentStatus = integrationStatus("propresenter", "error", true, message);
    this.slideState = blankSlideState();
    this.emit();
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? 30_000;
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.refresh();
    }, delay);
  }

  private disconnect() {
    const controller = this.abortController;
    this.abortController = null;
    if (!controller) return;
    try {
      controller.abort();
    } catch {}
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private getSettings() {
    return this.settingsRepository.getRuntimeSettings().integrations.propresenter;
  }

  private emit() {
    this.onChange();
  }
}
