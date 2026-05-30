import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { getSanitizedConfigStatus } from "./configStatus";
import { bootstrapRuntimeSettingsFromEnv } from "./envBootstrap";
import { runMigrations, seedDefaultSettings } from "./migrations";
import { SettingsRepository } from "./settingsRepository";

function repository() {
  const db = new Database(":memory:");
  runMigrations(db);
  seedDefaultSettings(db);
  return new SettingsRepository(db);
}

test("env bootstrap imports first-run defaults without exposing secret values", () => {
  const settingsRepository = repository();

  const settings = bootstrapRuntimeSettingsFromEnv(settingsRepository, {
    OBS_ENABLED: "true",
    OBS_HOST: "10.0.0.12",
    OBS_PORT: "4455",
    PCO_ENABLED: "true",
    PCO_SERVICE_TYPE_ID: "123",
    PCO_PLAN_ID: "456",
    PCO_TOKEN: "secret-token",
  });

  expect(settings.integrations.obs.enabled).toBe(true);
  expect(settings.integrations.obs.host).toBe("10.0.0.12");
  expect(settings.integrations.pco.extra.serviceTypeId).toBe("123");
  expect(settings.secretPresence.pco.token).toBe(true);

  const config = getSanitizedConfigStatus(settings);
  expect(JSON.stringify(config)).not.toContain("secret-token");
  expect(config.pco.configured).toBe(true);
});

test("env bootstrap does not overwrite operator-edited runtime settings or existing secrets", () => {
  const settingsRepository = repository();

  bootstrapRuntimeSettingsFromEnv(settingsRepository, {
    OBS_ENABLED: "true",
    OBS_HOST: "10.0.0.12",
    OBS_PASSWORD: "first-password",
  });

  settingsRepository.updateRuntimeSettings({
    integrations: {
      obs: { host: "10.0.0.99" },
    },
  });

  bootstrapRuntimeSettingsFromEnv(settingsRepository, {
    OBS_ENABLED: "true",
    OBS_HOST: "10.0.0.44",
    OBS_PASSWORD: "second-password",
  });

  const settings = settingsRepository.getRuntimeSettings();
  expect(settings.integrations.obs.host).toBe("10.0.0.99");
  expect(settingsRepository.getSecretStore().getSecret("obs", "password")).toBe("first-password");
});
