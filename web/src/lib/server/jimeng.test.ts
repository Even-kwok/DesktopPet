import test from "node:test";
import assert from "node:assert/strict";

import {
  defaultJimengVideoModel,
  getJimengApiKey,
  getJimengApiKeyCandidates,
  getJimengVideoModel
} from "./jimeng-env.ts";

const providerEnvKeys = [
  "mini_API_KEY",
  "MINI_API_KEY",
  "DOUBAO_SEED_API_KEY",
  "JIMENG_MINI_API_KEY",
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

test("Jimeng config defaults to the Doubao Seed 2.0 mini model", () => {
  withProviderEnv({ ARK_API_KEY: " ark-secret " }, () => {
    assert.equal(getJimengApiKey(), "ark-secret");
    assert.equal(defaultJimengVideoModel, "doubao-seed-2-0-mini-260428");
    assert.equal(getJimengVideoModel(), "doubao-seed-2-0-mini-260428");
  });
});

test("Jimeng config prefers the mini API key when the Doubao Seed model is selected", () => {
  withProviderEnv(
    {
      mini_API_KEY: " mini-secret ",
      JIMENG_API_KEY: "jimeng-secret",
      ARK_API_KEY: "ark-secret"
    },
    () => {
      assert.equal(getJimengApiKey("doubao-seed-2-0-mini-260428"), "mini-secret");
    }
  );
});

test("Jimeng config keeps fallback API key candidates for invalid mini keys", () => {
  withProviderEnv(
    {
      mini_API_KEY: "bad-mini",
      JIMENG_API_KEY: "bad-mini",
      ARK_API_KEY: "ark-secret"
    },
    () => {
      assert.deepEqual(getJimengApiKeyCandidates("doubao-seed-2-0-mini-260428"), [
        { name: "mini_API_KEY", value: "bad-mini" },
        { name: "ARK_API_KEY", value: "ark-secret" }
      ]);
      assert.equal(getJimengApiKey("doubao-seed-2-0-mini-260428"), "bad-mini");
    }
  );
});

test("Jimeng config ignores legacy Seedance env model overrides", () => {
  withProviderEnv(
    {
      mini_API_KEY: "mini-secret",
      ARK_API_KEY: "ark-secret",
      JIMENG_VIDEO_MODEL: "doubao-seedance-2-0-fast-260128"
    },
    () => {
      assert.equal(getJimengVideoModel(), "doubao-seed-2-0-mini-260428");
    }
  );
});
