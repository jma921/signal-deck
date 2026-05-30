import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const APP_NAME = "SignalDeck";
const DB_FILE = "signaldeck.sqlite";

export function getAppDataDir(): string {
  if (process.env.SIGNALDECK_DATA_DIR) return process.env.SIGNALDECK_DATA_DIR;

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", APP_NAME);
  }

  return path.join(process.env.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share"), APP_NAME);
}

export function getDatabasePath(): string {
  const dir = getAppDataDir();
  mkdirSync(dir, { recursive: true });
  return path.join(dir, DB_FILE);
}
