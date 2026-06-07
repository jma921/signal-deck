import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { runMigrations, seedDefaultSettings } from "../../runtime/migrations";
import { SettingsRepository } from "../../runtime/settingsRepository";
import { ProPresenterManager } from "./proPresenterManager";

const originalFetch = globalThis.fetch;

function repository() {
  const db = new Database(":memory:");
  runMigrations(db);
  seedDefaultSettings(db);
  const settingsRepository = new SettingsRepository(db);
  settingsRepository.updateRuntimeSettings({
    integrations: {
      propresenter: {
        enabled: true,
        host: "127.0.0.1",
        port: 1025,
      },
    },
  });
  return settingsRepository;
}

// A chunked-stream Response that emits each line as a separate enqueue and then
// stays open, mimicking ProPresenter's long-lived `?chunked=true` connection.
function streamResponse(lines: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) controller.enqueue(encoder.encode(line + "\n"));
    },
  });
  return new Response(stream, { status: 200 });
}

async function waitFor(predicate: () => boolean, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("ProPresenter manager maps current/next slide text and the live layer", async () => {
  const settingsRepository = repository();
  const manager = new ProPresenterManager(settingsRepository, () => {});

  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes("/v1/presentation/active")) {
      return Response.json({
        presentation: {
          id: { name: "Mercy Like A River" },
          groups: [
            { name: "Chorus", slides: [{ text: "Your mercy flows like a river" }] },
            { name: "Chorus 2", slides: [{ text: "I am Yours and You are with me" }] },
          ],
        },
      });
    }
    if (url.includes("/v1/status/slide")) {
      return streamResponse([
        JSON.stringify({
          current: { text: "Your mercy flows like a river" },
          next: { text: "I am Yours and You are with me" },
        }),
      ]);
    }
    if (url.includes("/v1/status/layers")) {
      return streamResponse([JSON.stringify({ slide: true })]);
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;

  manager.start();
  await waitFor(() => manager.getSlideState()?.currentLabel === "Chorus"
    && manager.getSlideState()?.live === true);

  const slides = manager.getSlideState();
  expect(slides?.presentation).toBe("Mercy Like A River");
  expect(slides?.currentText).toBe("Your mercy flows like a river");
  expect(slides?.currentLabel).toBe("Chorus");
  expect(slides?.nextText).toBe("I am Yours and You are with me");
  expect(slides?.nextLabel).toBe("Chorus 2");
  expect(slides?.live).toBe(true);
  expect(manager.getStatus().state).toBe("connected");

  manager.stop();
});

test("ProPresenter manager flips live to false when the slide layer is cleared", async () => {
  const settingsRepository = repository();
  const manager = new ProPresenterManager(settingsRepository, () => {});

  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes("/v1/status/slide")) {
      return streamResponse([JSON.stringify({ current: { text: "Bridge" }, next: { text: "Outro" } })]);
    }
    if (url.includes("/v1/status/layers")) {
      // Slide layer is shown, then cleared.
      return streamResponse([JSON.stringify({ slide: true }), JSON.stringify({ slide: false })]);
    }
    return new Response("Not found", { status: 404 });
  }) as typeof fetch;

  manager.start();
  await waitFor(() => manager.getSlideState()?.live === false && manager.getSlideState()?.currentText === "Bridge");

  expect(manager.getSlideState()?.live).toBe(false);
  expect(manager.getSlideState()?.currentText).toBe("Bridge");

  manager.stop();
});

test("ProPresenter manager reports missing-config without host or port", async () => {
  const settingsRepository = repository();
  settingsRepository.updateRuntimeSettings({
    integrations: { propresenter: { enabled: true, host: null, port: null } },
  });
  const manager = new ProPresenterManager(settingsRepository, () => {});

  await manager.refresh();

  expect(manager.getStatus().state).toBe("missing-config");
  expect(manager.getSlideState()).toBeNull();
});
