import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { runMigrations, seedDefaultSettings } from "../runtime/migrations";
import { SettingsRepository } from "../runtime/settingsRepository";
import { ServerProductionStore } from "./serverProductionStore";

function repository() {
  const db = new Database(":memory:");
  runMigrations(db);
  seedDefaultSettings(db);
  return new SettingsRepository(db);
}

test("server production store preserves local Service Position when live PCO order is unavailable", () => {
  const settingsRepository = repository();
  const store = new ServerProductionStore(settingsRepository);

  expect(store.setServicePosition("sim-great-is-lord")).toBe(true);

  settingsRepository.updateRuntimeSettings({
    app: { mode: "live" },
    integrations: {
      pco: { enabled: true },
    },
  });

  const snapshot = store.getSnapshot();
  expect(snapshot.servicePosition.serviceItemId).toBe("sim-great-is-lord");
  expect(snapshot.serviceOrder.source).toBe("pco");
  expect(snapshot.serviceOrder.stale).toBe(true);
  expect(snapshot.serviceOrder.items).toEqual([]);
});

test("server production store exposes one Connection row per integration manager", () => {
  const store = new ServerProductionStore(repository());
  const snapshot = store.getSnapshot();

  expect(snapshot.connections.map((connection) => connection.id)).toEqual([
    "pco",
    "obs",
  ]);
});
