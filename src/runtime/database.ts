import { Database } from "bun:sqlite";
import { getDatabasePath } from "./appDataPath";
import { runMigrations, seedDefaultSettings } from "./migrations";

let db: Database | null = null;

export function openRuntimeDatabase(): Database {
  if (db) return db;

  db = new Database(getDatabasePath(), { create: true });
  db.run("pragma foreign_keys = on");
  db.run("pragma journal_mode = wal");
  runMigrations(db);
  seedDefaultSettings(db);
  return db;
}
