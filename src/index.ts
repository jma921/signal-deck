import { serve } from "bun";
import index from "./index.html";
import { openRuntimeDatabase } from "./runtime/database";
import { SettingsRepository, type RuntimeSettingsPatch } from "./runtime/settingsRepository";
import { isIntegrationKey } from "./runtime/settings";
import { isLoopbackRequest, localOnlyResponse } from "./server/localOnly";

const db = openRuntimeDatabase();
const settingsRepository = new SettingsRepository(db);
const runtimeSettings = settingsRepository.getRuntimeSettings();

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

const server = serve({
  hostname: runtimeSettings.app.bindHost,

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

        return Response.json(settingsRepository.updateRuntimeSettings(body));
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

        return Response.json(settingsRepository.getRuntimeSettings());
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
