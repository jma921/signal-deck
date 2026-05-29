import type { Database } from "bun:sqlite";
import { DEFAULT_APP_SETTINGS, DEFAULT_INTEGRATION_SETTINGS } from "./settings";

interface Migration {
  id: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: "0001_runtime_settings",
    sql: `
      create table if not exists schema_migrations (
        id text primary key,
        applied_at text not null
      );

      create table if not exists app_settings (
        key text primary key,
        value text not null,
        updated_at text not null
      );

      create table if not exists integration_settings (
        integration_key text primary key,
        enabled integer not null,
        host text,
        port integer,
        extra_json text,
        updated_at text not null
      );

      create table if not exists secrets (
        integration_key text not null,
        secret_key text not null,
        secret_value text not null,
        updated_at text not null,
        primary key (integration_key, secret_key)
      );
    `,
  },
];

function nowIso() {
  return new Date().toISOString();
}

export function runMigrations(db: Database) {
  db.run(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at text not null
    );
  `);

  const hasMigration = db.query<{ id: string }, [string]>(
    "select id from schema_migrations where id = ?"
  );
  const markMigration = db.query(
    "insert into schema_migrations (id, applied_at) values (?, ?)"
  );

  db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (hasMigration.get(migration.id)) continue;
      db.exec(migration.sql);
      markMigration.run(migration.id, nowIso());
    }
  })();
}

export function seedDefaultSettings(db: Database) {
  const now = nowIso();
  const insertAppSetting = db.query(
    "insert or ignore into app_settings (key, value, updated_at) values (?, ?, ?)"
  );
  insertAppSetting.run("mode", DEFAULT_APP_SETTINGS.mode, now);
  insertAppSetting.run("bind_host", DEFAULT_APP_SETTINGS.bindHost, now);
  insertAppSetting.run("lan_read_only_enabled", DEFAULT_APP_SETTINGS.lanReadOnlyEnabled ? "true" : "false", now);

  const insertIntegration = db.query(`
    insert or ignore into integration_settings
      (integration_key, enabled, host, port, extra_json, updated_at)
    values (?, ?, ?, ?, ?, ?)
  `);

  for (const settings of Object.values(DEFAULT_INTEGRATION_SETTINGS)) {
    insertIntegration.run(
      settings.integrationKey,
      settings.enabled ? 1 : 0,
      settings.host,
      settings.port,
      JSON.stringify(settings.extra),
      now,
    );
  }
}
