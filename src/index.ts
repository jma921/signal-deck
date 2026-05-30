import { serve } from "bun";
import index from "./index.html";
import { ServerProductionStore } from "./production/serverProductionStore";
import { getSanitizedConfigStatus } from "./runtime/configStatus";
import { openRuntimeDatabase } from "./runtime/database";
import { bootstrapRuntimeSettingsFromEnv } from "./runtime/envBootstrap";
import { SettingsRepository, type RuntimeSettingsPatch } from "./runtime/settingsRepository";
import { isIntegrationKey } from "./runtime/settings";
import { isLoopbackRequest, localOnlyResponse } from "./server/localOnly";

const db = openRuntimeDatabase();
const settingsRepository = new SettingsRepository(db);
bootstrapRuntimeSettingsFromEnv(settingsRepository);
const runtimeSettings = settingsRepository.getRuntimeSettings();
const productionStore = new ServerProductionStore(settingsRepository);
const integrationManager = productionStore.getIntegrationManager();
productionStore.start();
const port = Number(process.env.PORT ?? 3000);

function requestIp(req: Request): string | null {
  try {
    return server.requestIP(req)?.address ?? null;
  } catch {
    return null;
  }
}

function requireLocal(req: Request): Response | null {
  return isLoopbackRequest(req, requestIp(req)) ? null : localOnlyResponse();
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

interface SecretPatchRequest {
  integrationKey?: string;
  secrets?: Record<string, string | null>;
}

interface ServicePositionRequest {
  serviceItemId?: string;
}

function snapshotStream() {
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      unsubscribe = productionStore.subscribe((snapshot) => {
        controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`));
      });
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

const server = serve({
  hostname: runtimeSettings.app.bindHost,
  port,

  routes: {
    "/api/health": {
      async GET() {
        const currentSettings = settingsRepository.getRuntimeSettings();
        return Response.json({
          ok: true,
          mode: currentSettings.app.mode,
          bindHost: runtimeSettings.app.bindHost,
          configuredBindHost: currentSettings.app.bindHost,
        });
      },
    },

    "/api/config": {
      async GET(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json({ integrations: getSanitizedConfigStatus(settingsRepository.getRuntimeSettings()) });
      },
    },

    "/api/settings": {
      async GET(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json(settingsRepository.getRuntimeSettings());
      },
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;

        const body = await readJson<RuntimeSettingsPatch>(req);
        if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

        const settings = settingsRepository.updateRuntimeSettings(body);
        void integrationManager.refresh();
        productionStore.emit();
        return Response.json(settings);
      },
    },

    "/api/secrets": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;

        const body = await readJson<SecretPatchRequest>(req);
        if (!body?.integrationKey || !isIntegrationKey(body.integrationKey) || !body.secrets) {
          return Response.json({ error: "Expected integrationKey and secrets." }, { status: 400 });
        }

        const secretStore = settingsRepository.getSecretStore();
        for (const [secretKey, secretValue] of Object.entries(body.secrets)) {
          if (!secretKey) continue;
          if (secretValue == null || secretValue === "") {
            secretStore.clearSecret(body.integrationKey, secretKey);
          } else {
            secretStore.setSecret(body.integrationKey, secretKey, secretValue);
          }
        }

        void integrationManager.refresh();
        productionStore.emit();
        return Response.json(settingsRepository.getRuntimeSettings());
      },
    },

    "/api/production/snapshot": {
      async GET() {
        return Response.json(productionStore.getSnapshot());
      },
    },

    "/api/production/stream": {
      async GET() {
        return snapshotStream();
      },
    },

    "/api/production/position": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;

        const body = await readJson<ServicePositionRequest>(req);
        if (!body?.serviceItemId) return Response.json({ error: "Expected serviceItemId." }, { status: 400 });
        if (!productionStore.setServicePosition(body.serviceItemId)) {
          return Response.json({ error: "Unknown Service Item." }, { status: 404 });
        }
        return Response.json(productionStore.getSnapshot());
      },
    },

    "/api/production/advance": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        if (!productionStore.advanceServicePosition()) return Response.json({ error: "Cannot advance Service Position." }, { status: 400 });
        return Response.json(productionStore.getSnapshot());
      },
    },

    "/api/production/retreat": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        if (!productionStore.retreatServicePosition()) return Response.json({ error: "Cannot retreat Service Position." }, { status: 400 });
        return Response.json(productionStore.getSnapshot());
      },
    },

    "/api/integrations/status": {
      async GET(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json({ integrations: integrationManager.getStatuses() });
      },
    },

    "/api/integrations/obs/test": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json(await integrationManager.testObs());
      },
    },

    "/api/integrations/obs/reconnect": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json(await integrationManager.reconnectObs());
      },
    },

    "/api/integrations/pco/refresh": {
      async POST(req) {
        const blocked = requireLocal(req);
        if (blocked) return blocked;
        return Response.json(await integrationManager.refreshPco());
      },
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
