import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Dot, Panel } from "../components/atoms";
import type { IntegrationKey, RuntimeSettings } from "../runtime/settings";
import {
  formFromRuntimeSettings,
  runtimeSettingsPatchFromForm,
  secretPatchRequestsFromForm,
  type ConfigStatus,
  type IntegrationStatusView,
  type SettingsFormState,
} from "./settingsForm";

interface SettingsPageProps {
  onBack: () => void;
}

type LoadState = "loading" | "ready" | "error";

interface ActionResult {
  tone: "ok" | "warn" | "err";
  message: string;
}

const STATE_COLOR: Record<string, string> = {
  ok: "#34d399",
  warn: "#f0b429",
  err: "#ff5c5c",
  connected: "#34d399",
  connecting: "#f0b429",
  "missing-config": "#f0b429",
  disabled: "#5a6072",
  error: "#ff5c5c",
};

const CONNECTION_LABEL: Record<IntegrationKey, string> = {
  pco: "PCO Services",
  propresenter: "ProPresenter",
  obs: "OBS Encoder",
};

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${path} returned ${res.status}`);
  }
  return await res.json() as T;
}

function updateNested<T extends keyof SettingsFormState, K extends keyof SettingsFormState[T]>(
  setForm: Dispatch<SetStateAction<SettingsFormState | null>>,
  section: T,
  key: K,
  value: SettingsFormState[T][K],
) {
  setForm((current) => current ? {
    ...current,
    [section]: {
      ...current[section],
      [key]: value,
    },
  } : current);
}

function statusTone(config: ConfigStatus | null, statuses: IntegrationStatusView[], key: IntegrationKey): "ok" | "warn" | "err" {
  const runtime = statuses.find((status) => status.integrationKey === key);
  if (runtime?.state === "error") return "err";
  if (runtime?.state === "connected") return "ok";
  if (config?.[key]?.configured) return "ok";
  return "warn";
}

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const color = tone === "ok" ? STATE_COLOR.ok : tone === "warn" ? STATE_COLOR.warn : STATE_COLOR.err;
  return (
    <span className="sd-settings-pill" style={{ color, borderColor: color + "55" }}>
      <Dot color={color} size={6} />
      {children}
    </span>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"sd-settings-field" + (wide ? " sd-settings-field-wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="sd-settings-input" {...props} />;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={"sd-settings-toggle" + (checked ? " sd-settings-toggle-on" : "")}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="sd-settings-toggle-track"><span /></span>
      <span>{label}</span>
    </button>
  );
}

function SecretField({
  label,
  saved,
  value,
  clear,
  onValue,
  onClear,
}: {
  label: string;
  saved: boolean;
  value: string;
  clear: boolean;
  onValue: (value: string) => void;
  onClear: (value: boolean) => void;
}) {
  return (
    <div className="sd-settings-secret">
      <Field label={label} wide>
        <TextInput
          type="password"
          autoComplete="new-password"
          value={value}
          placeholder={saved ? "Leave blank to keep saved secret" : "Paste secret"}
          onChange={(event) => onValue(event.target.value)}
        />
      </Field>
      <div className="sd-settings-secret-row">
        <span className={"sd-settings-secret-state" + (saved ? " sd-settings-secret-saved" : "")}>
          {saved ? "saved" : "not saved"}
        </span>
        {saved && (
          <label className="sd-settings-check">
            <input type="checkbox" checked={clear} onChange={(event) => onClear(event.target.checked)} />
            Clear saved secret
          </label>
        )}
      </div>
    </div>
  );
}

function MissingList({ config }: { config: ConfigStatus[IntegrationKey] | undefined }) {
  if (!config || config.missing.length === 0) return null;
  return (
    <div className="sd-settings-missing">
      {config.missing.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [statuses, setStatuses] = useState<IntegrationStatusView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  const refresh = useCallback(async () => {
    const [runtime, configResponse, statusResponse] = await Promise.all([
      apiJson<RuntimeSettings>("/api/settings"),
      apiJson<{ integrations: ConfigStatus }>("/api/config"),
      apiJson<{ integrations: IntegrationStatusView[] }>("/api/integrations/status"),
    ]);

    setSettings(runtime);
    setForm((current) => current ? {
      ...formFromRuntimeSettings(runtime),
      pco: {
        ...formFromRuntimeSettings(runtime).pco,
        secret: current.pco.secret,
        clearSecret: current.pco.clearSecret,
      },
      obs: {
        ...formFromRuntimeSettings(runtime).obs,
        password: current.obs.password,
        clearPassword: current.obs.clearPassword,
      },
    } : formFromRuntimeSettings(runtime));
    setConfig(configResponse.integrations);
    setStatuses(statusResponse.integrations);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    refresh()
      .then(() => {
        if (!cancelled) setLoadState("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Settings failed to load.");
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const save = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      await apiJson<RuntimeSettings>("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtimeSettingsPatchFromForm(form)),
      });

      for (const secretPatch of secretPatchRequestsFromForm(form)) {
        await apiJson<RuntimeSettings>("/api/secrets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(secretPatch),
        });
      }

      setForm((current) => current ? {
        ...current,
        pco: { ...current.pco, secret: "", clearSecret: false },
        obs: { ...current.obs, password: "", clearPassword: false },
      } : current);
      await refresh();
      setSaveMessage({ tone: "ok", message: "Connections Settings saved." });
    } catch (err) {
      setSaveMessage({ tone: "err", message: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }, [form, refresh]);

  const runAction = useCallback(async (path: string, success: string) => {
    setActionResult(null);
    try {
      const result = await apiJson<{ ok?: boolean; status?: { message?: string | null }; message?: string | null } | { message?: string | null }>(path, { method: "POST" });
      await refresh();
      setActionResult({ tone: "ok", message: result.message ?? ("status" in result ? result.status?.message : null) ?? success });
    } catch (err) {
      setActionResult({ tone: "err", message: err instanceof Error ? err.message : "Action failed." });
    }
  }, [refresh]);

  const pageTone = useMemo(() => {
    if (!config) return "warn";
    return (config.pco.configured && config.obs.configured) ? "ok" : "warn";
  }, [config]);

  if (loadState === "loading" || !form) {
    return (
      <div className="sd-root sd-settings-root">
        <SettingsHeader onBack={onBack} tone="warn" />
        <main className="sd-settings-shell">
          <Panel title="Connections Settings" bodyClass="sd-settings-loading">
            Loading settings
          </Panel>
        </main>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="sd-root sd-settings-root">
        <SettingsHeader onBack={onBack} tone="err" />
        <main className="sd-settings-shell">
          <Panel title="Connections Settings" bodyClass="sd-settings-loading">
            {error ?? "Settings unavailable."}
          </Panel>
        </main>
      </div>
    );
  }

  return (
    <div className="sd-root sd-settings-root">
      <SettingsHeader onBack={onBack} tone={pageTone} />

      <main className="sd-settings-shell">
        <section className="sd-settings-topline">
          <div>
            <div className="sd-settings-kicker">Connections Settings</div>
            <h1>Local production systems</h1>
          </div>
          <div className="sd-settings-actions">
            {saveMessage && <StatusPill tone={saveMessage.tone}>{saveMessage.message}</StatusPill>}
            <button className="sd-settings-primary" type="button" onClick={save} disabled={saving}>
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </section>

        <div className="sd-settings-grid">
          <Panel
            title="App"
            right={<StatusPill tone={form.appMode === "live" ? "ok" : "warn"}>{form.appMode}</StatusPill>}
            bodyClass="sd-settings-panel"
          >
            <div className="sd-settings-mode">
              <button
                type="button"
                className={form.appMode === "simulation" ? "sd-settings-mode-active" : ""}
                onClick={() => setForm((current) => current ? { ...current, appMode: "simulation" } : current)}
              >
                Simulation
              </button>
              <button
                type="button"
                className={form.appMode === "live" ? "sd-settings-mode-active" : ""}
                onClick={() => setForm((current) => current ? { ...current, appMode: "live" } : current)}
              >
                Live
              </button>
            </div>
          </Panel>

          <Panel
            title="PCO Services"
            right={<StatusPill tone={statusTone(config, statuses, "pco")}>{config?.pco.configured ? "configured" : "missing"}</StatusPill>}
            bodyClass="sd-settings-panel"
          >
            <ConnectionRuntime status={statuses.find((status) => status.integrationKey === "pco")} />
            <Toggle
              label="Enabled"
              checked={form.pco.enabled}
              onChange={(checked) => updateNested(setForm, "pco", "enabled", checked)}
            />
            <div className="sd-settings-fields">
              <Field label="Service Type ID">
                <TextInput value={form.pco.serviceTypeId} onChange={(event) => updateNested(setForm, "pco", "serviceTypeId", event.target.value)} />
              </Field>
              <Field label="Plan ID">
                <TextInput value={form.pco.planId} onChange={(event) => updateNested(setForm, "pco", "planId", event.target.value)} />
              </Field>
              <Field label="Base URL" wide>
                <TextInput value={form.pco.baseUrl} placeholder="https://api.planningcenteronline.com" onChange={(event) => updateNested(setForm, "pco", "baseUrl", event.target.value)} />
              </Field>
              <Field label="Poll Seconds">
                <TextInput inputMode="numeric" value={form.pco.pollSeconds} onChange={(event) => updateNested(setForm, "pco", "pollSeconds", event.target.value)} />
              </Field>
              <Field label="Client ID" wide>
                <TextInput value={form.pco.clientId} autoComplete="off" onChange={(event) => updateNested(setForm, "pco", "clientId", event.target.value)} />
              </Field>
            </div>
            <SecretField
              label="Secret"
              saved={settings?.secretPresence.pco?.secret === true}
              value={form.pco.secret}
              clear={form.pco.clearSecret}
              onValue={(value) => updateNested(setForm, "pco", "secret", value)}
              onClear={(checked) => updateNested(setForm, "pco", "clearSecret", checked)}
            />
            <MissingList config={config?.pco} />
            <button className="sd-settings-secondary" type="button" onClick={() => void runAction("/api/integrations/pco/refresh", "PCO Services refresh requested.")}>
              Refresh PCO Services
            </button>
          </Panel>

          <Panel
            title="ProPresenter"
            right={<StatusPill tone={statusTone(config, statuses, "propresenter")}>{config?.propresenter.configured ? "configured" : "missing"}</StatusPill>}
            bodyClass="sd-settings-panel"
          >
            <ConnectionRuntime status={statuses.find((status) => status.integrationKey === "propresenter")} />
            <Toggle
              label="Enabled"
              checked={form.propresenter.enabled}
              onChange={(checked) => updateNested(setForm, "propresenter", "enabled", checked)}
            />
            <div className="sd-settings-fields">
              <Field label="Host / IP">
                <TextInput value={form.propresenter.host} onChange={(event) => updateNested(setForm, "propresenter", "host", event.target.value)} />
              </Field>
              <Field label="Port">
                <TextInput inputMode="numeric" value={form.propresenter.port} placeholder="1025" onChange={(event) => updateNested(setForm, "propresenter", "port", event.target.value)} />
              </Field>
            </div>
            <MissingList config={config?.propresenter} />
          </Panel>

          <Panel
            title="OBS Encoder"
            right={<StatusPill tone={statusTone(config, statuses, "obs")}>{config?.obs.configured ? "configured" : "missing"}</StatusPill>}
            bodyClass="sd-settings-panel"
          >
            <ConnectionRuntime status={statuses.find((status) => status.integrationKey === "obs")} />
            <Toggle
              label="Enabled"
              checked={form.obs.enabled}
              onChange={(checked) => updateNested(setForm, "obs", "enabled", checked)}
            />
            <div className="sd-settings-fields">
              <Field label="Host / IP">
                <TextInput value={form.obs.host} onChange={(event) => updateNested(setForm, "obs", "host", event.target.value)} />
              </Field>
              <Field label="Port">
                <TextInput inputMode="numeric" value={form.obs.port} onChange={(event) => updateNested(setForm, "obs", "port", event.target.value)} />
              </Field>
            </div>
            <SecretField
              label="Password"
              saved={settings?.secretPresence.obs?.password === true}
              value={form.obs.password}
              clear={form.obs.clearPassword}
              onValue={(value) => updateNested(setForm, "obs", "password", value)}
              onClear={(checked) => updateNested(setForm, "obs", "clearPassword", checked)}
            />
            <MissingList config={config?.obs} />
            <button className="sd-settings-secondary" type="button" onClick={() => void runAction("/api/integrations/obs/test", "OBS test requested.")}>
              Test OBS Connection
            </button>
          </Panel>
        </div>

        {actionResult && (
          <div className="sd-settings-action-result">
            <StatusPill tone={actionResult.tone}>{actionResult.message}</StatusPill>
          </div>
        )}
      </main>
    </div>
  );
}

function ConnectionRuntime({ status }: { status: IntegrationStatusView | undefined }) {
  if (!status) return null;
  const color = STATE_COLOR[status.state] ?? STATE_COLOR.warn;
  return (
    <div className="sd-settings-runtime">
      <span style={{ color }}>
        <Dot color={color} size={6} />
        {status.state}
      </span>
      <span>{status.message ?? CONNECTION_LABEL[status.integrationKey]}</span>
    </div>
  );
}

function SettingsHeader({ onBack, tone }: { onBack: () => void; tone: "ok" | "warn" | "err" }) {
  const color = tone === "ok" ? STATE_COLOR.ok : tone === "warn" ? STATE_COLOR.warn : STATE_COLOR.err;
  return (
    <header className="sd-header">
      <div className="sd-brand">
        <span className="sd-brand-mark" aria-hidden="true">
          <span className="sd-brand-arc" />
          <span className="sd-brand-arc" />
          <span className="sd-brand-arc" />
        </span>
        <span className="sd-brand-name">
          Signal<span className="sd-brand-name-b">Deck</span>
        </span>
        <span className="sd-brand-sub">CONNECTIONS</span>
      </div>
      <div className="sd-header-right">
        <span className="sd-live-badge sd-live-off" style={{ color, borderColor: color + "55" }}>
          <Dot color={color} />
          SETTINGS
        </span>
        <button className="sd-header-btn" type="button" onClick={onBack}>Back to Dashboard</button>
      </div>
    </header>
  );
}
