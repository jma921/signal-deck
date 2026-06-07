import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { runMigrations, seedDefaultSettings } from "../../runtime/migrations";
import { SettingsRepository } from "../../runtime/settingsRepository";
import { SocialStreamManager } from "./socialStreamManager";

const originalWebSocket = globalThis.WebSocket;

function repository(sessionId?: string) {
  const db = new Database(":memory:");
  runMigrations(db);
  seedDefaultSettings(db);
  const repo = new SettingsRepository(db);
  repo.updateRuntimeSettings({
    integrations: { socialstream: { enabled: true } },
  });
  if (sessionId) {
    repo.getSecretStore().setSecret("socialstream", "sessionId", sessionId);
  }
  return repo;
}

async function waitFor(predicate: () => boolean, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
});

// Minimal WebSocket mock that fires onopen immediately and lets the test push messages.
function mockWebSocket(sessionId: string): { push: (data: string) => void; close: () => void } {
  let manager: { onopen?: (() => void) | null; onmessage?: ((e: MessageEvent) => void) | null; onclose?: (() => void) | null; onerror?: (() => void) | null } | null = null;

  globalThis.WebSocket = class MockWS {
    onopen: (() => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(url: string) {
      expect(url).toContain(sessionId);
      manager = this;
      setTimeout(() => this.onopen?.(), 0);
    }

    close() {
      manager = null;
    }
  } as unknown as typeof WebSocket;

  return {
    push(data: string) {
      manager?.onmessage?.({ data } as MessageEvent);
    },
    close() {
      manager?.onclose?.();
      manager = null;
    },
  };
}

test("SocialStreamManager parses YouTube and Facebook messages into ChatMessage shape", async () => {
  const repo = repository("test-session-id");
  const mock = mockWebSocket("test-session-id");
  const changes: number[] = [];
  const manager = new SocialStreamManager(repo, () => changes.push(Date.now()));

  manager.start();
  await waitFor(() => manager.getStatus().state === "connected");

  mock.push(JSON.stringify({ type: "youtube", chatname: "GraceNotes_Mae", chatmessage: "Worshipping from Ohio", id: "yt-1" }));
  mock.push(JSON.stringify({ type: "facebook", chatname: "Daniel Okafor", chatmessage: "Sounds great!", id: "fb-1" }));
  mock.push(JSON.stringify({ type: "unknown_platform", chatname: "Bot", chatmessage: "Ignored", id: "bot-1" }));

  await waitFor(() => (manager.getChatMessages()?.length ?? 0) >= 2);

  const msgs = manager.getChatMessages();
  expect(msgs).toHaveLength(2);

  expect(msgs![0].platform).toBe("YT");
  expect(msgs![0].author).toBe("GraceNotes_Mae");
  expect(msgs![0].text).toBe("Worshipping from Ohio");
  expect(msgs![0].id).toBe("yt-1");

  expect(msgs![1].platform).toBe("FB");
  expect(msgs![1].author).toBe("Daniel Okafor");
  expect(msgs![1].text).toBe("Sounds great!");

  manager.stop();
});

test("SocialStreamManager caps chat history at 40 messages", async () => {
  const repo = repository("cap-test-session");
  const mock = mockWebSocket("cap-test-session");
  const manager = new SocialStreamManager(repo, () => {});

  manager.start();
  await waitFor(() => manager.getStatus().state === "connected");

  for (let i = 0; i < 50; i++) {
    mock.push(JSON.stringify({ type: "youtube", chatname: `user${i}`, chatmessage: `msg ${i}`, id: `id-${i}` }));
  }

  await waitFor(() => (manager.getChatMessages()?.length ?? 0) >= 40);

  expect(manager.getChatMessages()?.length).toBe(40);
  expect(manager.getChatMessages()![0].text).toBe("msg 10");

  manager.stop();
});

test("SocialStreamManager reports missing-config when session ID is absent", async () => {
  const repo = repository();
  const manager = new SocialStreamManager(repo, () => {});

  await manager.refresh();

  expect(manager.getStatus().state).toBe("missing-config");
  expect(manager.getChatMessages()).toBeNull();
});

test("SocialStreamManager exposes sendChat stub for future Reply and Broadcast", () => {
  const repo = repository("stub-session");
  const manager = new SocialStreamManager(repo, () => {});

  expect(typeof manager.sendChat).toBe("function");
  expect(() => manager.sendChat("Hello")).not.toThrow();
  expect(() => manager.sendChat("Hello", "YT")).not.toThrow();
  expect(() => manager.sendChat("Hello", "FB")).not.toThrow();
});

let wsInstance: { onopen?: (() => void) | null; onclose?: (() => void) | null; onerror?: (() => void) | null } | null = null;

beforeEach(() => { wsInstance = null; });

test("SocialStreamManager clears messages and reconnects after disconnect", async () => {
  const repo = repository("reconnect-session");

  globalThis.WebSocket = class MockWS {
    onopen: (() => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      wsInstance = this;
      setTimeout(() => this.onopen?.(), 0);
    }

    close() {}
  } as unknown as typeof WebSocket;

  const manager = new SocialStreamManager(repo, () => {});
  manager.start();
  await waitFor(() => manager.getStatus().state === "connected");

  wsInstance?.onclose?.();
  await waitFor(() => manager.getStatus().state === "error");

  expect(manager.getChatMessages()).toBeNull();

  manager.stop();
});
