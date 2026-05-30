import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { runMigrations, seedDefaultSettings } from "../../runtime/migrations";
import { SettingsRepository } from "../../runtime/settingsRepository";
import { PcoManager } from "./pcoManager";

const originalFetch = globalThis.fetch;

function repository() {
  const db = new Database(":memory:");
  runMigrations(db);
  seedDefaultSettings(db);
  const settingsRepository = new SettingsRepository(db);
  settingsRepository.updateRuntimeSettings({
    integrations: {
      pco: {
        enabled: true,
        extra: {
          serviceTypeId: "service-type-1",
          planId: "plan-1",
          clientId: "pco-client-id",
        },
      },
    },
  });
  settingsRepository.getSecretStore().setSecret("pco", "secret", "pco-secret");
  return settingsRepository;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("PCO manager keeps the last successful Service Order in memory and marks it stale after a failure", async () => {
  const settingsRepository = repository();
  const manager = new PcoManager(settingsRepository, () => {});

  globalThis.fetch = async (input, init) => {
    expect(String(input)).toContain("/services/v2/service_types/service-type-1/plans/plan-1/items");
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("pco-client-id:pco-secret")}`);
    return Response.json({
      data: [
        {
          id: "item-1",
          attributes: {
            title: "Opening Song",
            item_type: "song",
            length: 240,
          },
        },
      ],
    });
  };

  await manager.refresh();
  expect(manager.getServiceOrder()?.items[0]?.name).toBe("Opening Song");
  expect(manager.getServiceOrder()?.stale).toBe(false);

  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });

  await manager.refresh();
  expect(manager.getStatus().state).toBe("error");
  expect(manager.getServiceOrder()?.items[0]?.name).toBe("Opening Song");
  expect(manager.getServiceOrder()?.stale).toBe(true);
});

test("PCO manager requires a client ID and secret", async () => {
  const settingsRepository = repository();
  settingsRepository.getSecretStore().clearSecret("pco", "secret");
  settingsRepository.getSecretStore().setSecret("pco", "token", "ignored-token");
  const manager = new PcoManager(settingsRepository, () => {});

  await manager.refresh();

  expect(manager.getStatus().state).toBe("missing-config");
  expect(manager.getStatus().message).toContain("client ID");
  expect(manager.getStatus().message).toContain("secret");
});
