import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultJimengVideoModel,
  getJimengApiKey,
  getJimengVideoModel
} from "./jimeng-env.ts";

const providerEnvKeys = [
  "mini_API_KEY",
  "JIMENG_API_KEY",
  "ARK_API_KEY",
  "JIMENG_VIDEO_MODEL",
  "JIMENG_API_BASE_URL",
  "JIMENG_QUERY_URL_TEMPLATE"
];

function withProviderEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const previousValues = new Map(providerEnvKeys.map((key) => [key, process.env[key]]));

  providerEnvKeys.forEach((key) => {
    delete process.env[key];
  });

  Object.entries(env).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value;
    }
  });

  try {
    return run();
  } finally {
    providerEnvKeys.forEach((key) => {
      const previousValue = previousValues.get(key);

      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    });
  }
}

test("Jimeng config defaults to the API-capable Seedance fast model", () => {
  withProviderEnv({ ARK_API_KEY: " fast-secret " }, () => {
    assert.equal(getJimengApiKey(), "fast-secret");
    assert.equal(defaultJimengVideoModel, "doubao-seedance-2-0-fast-260128");
    assert.equal(getJimengVideoModel(), "doubao-seedance-2-0-fast-260128");
  });
});

test("Jimeng config prefers the mini API key when the mini model is selected", () => {
  withProviderEnv(
    {
      mini_API_KEY: " mini-secret ",
      JIMENG_API_KEY: "jimeng-secret",
      ARK_API_KEY: "ark-secret"
    },
    () => {
      assert.equal(getJimengApiKey("doubao-seedance-2-0-mini-260615"), "mini-secret");
    }
  );
});

test("Jimeng config uses legacy provider keys when the fast model is selected", () => {
  withProviderEnv(
    {
      mini_API_KEY: "mini-secret",
      ARK_API_KEY: " fast-secret "
    },
    () => {
      assert.equal(getJimengApiKey("doubao-seedance-2-0-fast-260128"), "fast-secret");
      assert.equal(getJimengVideoModel(), "doubao-seedance-2-0-fast-260128");
    }
  );
});
