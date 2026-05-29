import type { Database } from "bun:sqlite";
import { INTEGRATION_KEYS, isIntegrationKey, type IntegrationKey } from "./settings";

interface SecretRow {
  integration_key: string;
  secret_key: string;
}

function nowIso() {
  return new Date().toISOString();
}

export class SecretStore {
  constructor(private readonly db: Database) {}

  setSecret(integrationKey: IntegrationKey, secretKey: string, secretValue: string) {
    this.db.query(`
      insert into secrets (integration_key, secret_key, secret_value, updated_at)
      values (?, ?, ?, ?)
      on conflict(integration_key, secret_key) do update set
        secret_value = excluded.secret_value,
        updated_at = excluded.updated_at
    `).run(integrationKey, secretKey, secretValue, nowIso());
  }

  clearSecret(integrationKey: IntegrationKey, secretKey: string) {
    this.db.query("delete from secrets where integration_key = ? and secret_key = ?")
      .run(integrationKey, secretKey);
  }

  getSecret(integrationKey: IntegrationKey, secretKey: string): string | null {
    const row = this.db.query<{ secret_value: string }, [string, string]>(
      "select secret_value from secrets where integration_key = ? and secret_key = ?"
    ).get(integrationKey, secretKey);
    return row?.secret_value ?? null;
  }

  getPresence(): Record<IntegrationKey, Record<string, boolean>> {
    const presence = Object.fromEntries(
      INTEGRATION_KEYS.map((key) => [key, {}])
    ) as Record<IntegrationKey, Record<string, boolean>>;

    const rows = this.db.query<SecretRow, []>(
      "select integration_key, secret_key from secrets order by integration_key, secret_key"
    ).all();

    for (const row of rows) {
      if (!isIntegrationKey(row.integration_key)) continue;
      presence[row.integration_key][row.secret_key] = true;
    }

    return presence;
  }
}
