import { expect, test } from "bun:test";
import {
  formFromRuntimeSettings,
  runtimeSettingsPatchFromForm,
  secretPatchRequestsFromForm,
  type SettingsFormState,
} from "./settingsForm";
import type { RuntimeSettings } from "../runtime/settings";

function runtimeSettings(): RuntimeSettings {
  return {
    app: {
      mode: "simulation",
      bindHost: "127.0.0.1",
      lanReadOnlyEnabled: false,
    },
    integrations: {
      pco: {
        integrationKey: "pco",
        enabled: true,
        host: null,
        port: null,
        extra: {
          baseUrl: "https://api.planningcenteronline.com",
          serviceTypeId: "service-type-1",
          planId: "plan-1",
          pollSeconds: 60,
          clientId: "client-1",
        },
      },
      propresenter: {
        integrationKey: "propresenter",
        enabled: false,
        host: "127.0.0.1",
        port: 1025,
        extra: {},
      },
      obs: {
        integrationKey: "obs",
        enabled: false,
        host: "127.0.0.1",
        port: 4455,
        extra: {},
      },
      socialstream: {
        integrationKey: "socialstream",
        enabled: false,
        host: null,
        port: null,
        extra: {},
      },
    },
    secretPresence: {
      pco: { secret: true },
      propresenter: {},
      obs: { password: true },
      socialstream: {},
    },
  };
}

test("settings form hydrates non-secret fields without exposing secret values", () => {
  const form = formFromRuntimeSettings(runtimeSettings());

  expect(form.pco.serviceTypeId).toBe("service-type-1");
  expect(form.pco.planId).toBe("plan-1");
  expect(form.pco.clientId).toBe("client-1");
  expect(form.pco.secret).toBe("");
  expect(form.obs.password).toBe("");
});

test("settings form serializes runtime settings separately from secrets", () => {
  const form: SettingsFormState = {
    appMode: "live",
    pco: {
      enabled: true,
      baseUrl: " https://api.planningcenteronline.com ",
      serviceTypeId: " service-type-1 ",
      planId: " plan-1 ",
      pollSeconds: "60",
      clientId: " client-id ",
      secret: "secret-token",
      clearSecret: false,
    },
    propresenter: {
      enabled: true,
      host: " 10.0.0.20 ",
      port: "1025",
    },
    obs: {
      enabled: true,
      host: " 10.0.0.21 ",
      port: "4455",
      password: "",
      clearPassword: true,
    },
    socialstream: {
      enabled: true,
      sessionId: "my-session-id",
      clearSessionId: false,
    },
  };

  expect(runtimeSettingsPatchFromForm(form)).toEqual({
    app: { mode: "live" },
    integrations: {
      pco: {
        enabled: true,
        extra: {
          serviceTypeId: "service-type-1",
          planId: "plan-1",
          baseUrl: "https://api.planningcenteronline.com",
          pollSeconds: 60,
          clientId: "client-id",
        },
      },
      propresenter: {
        enabled: true,
        host: "10.0.0.20",
        port: 1025,
      },
      obs: {
        enabled: true,
        host: "10.0.0.21",
        port: 4455,
      },
      socialstream: {
        enabled: true,
      },
    },
  });

  expect(secretPatchRequestsFromForm(form)).toEqual([
    { integrationKey: "pco", secrets: { secret: "secret-token" } },
    { integrationKey: "obs", secrets: { password: null } },
    { integrationKey: "socialstream", secrets: { sessionId: "my-session-id" } },
  ]);
});

test("blank secret fields do not create secret patches unless clear is selected", () => {
  const form = formFromRuntimeSettings(runtimeSettings());

  expect(secretPatchRequestsFromForm(form)).toEqual([]);

  form.pco.clearSecret = true;
  expect(secretPatchRequestsFromForm(form)).toEqual([
    { integrationKey: "pco", secrets: { secret: null } },
  ]);
});
