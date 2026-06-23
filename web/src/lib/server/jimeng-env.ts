import {
  defaultSeedanceVideoModel,
  isSeedanceVideoModel,
  seedanceFastModel,
  seedanceMiniModel,
  type SeedanceVideoModel
} from "../seedance-models.ts";

export const defaultJimengBaseUrl =
  "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks";
export const defaultJimengVideoModel = defaultSeedanceVideoModel;

export type JimengApiKeyCandidate = {
  name: string;
  value: string;
};

function firstTrimmedEnvValue(
  env: NodeJS.ProcessEnv,
  keys: string[]
) {
  for (const key of keys) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function trimmedEnvCandidates(env: NodeJS.ProcessEnv, keys: string[]) {
  const seenValues = new Set<string>();
  const candidates: JimengApiKeyCandidate[] = [];

  keys.forEach((key) => {
    const value = env[key]?.trim();

    if (value && !seenValues.has(value)) {
      seenValues.add(value);
      candidates.push({ name: key, value });
    }
  });

  return candidates;
}

export function getJimengApiKeyCandidates(
  model: SeedanceVideoModel = defaultJimengVideoModel,
  env: NodeJS.ProcessEnv = process.env
) {
  if (model === seedanceFastModel) {
    return trimmedEnvCandidates(env, [
      "DOUBAO_SEEDANCE_API_KEY",
      "DOUBAO_SEED_API_KEY",
      "JIMENG_API_KEY",
      "ARK_API_KEY"
    ]);
  }

  if (model === seedanceMiniModel) {
    return trimmedEnvCandidates(env, [
      "mini_API_KEY",
      "MINI_API_KEY",
      "DOUBAO_SEEDANCE_API_KEY",
      "DOUBAO_SEED_API_KEY",
      "JIMENG_MINI_API_KEY",
      "JIMENG_API_KEY",
      "ARK_API_KEY"
    ]);
  }

  return [];
}

export function getJimengApiKey(
  model: SeedanceVideoModel = defaultJimengVideoModel,
  env: NodeJS.ProcessEnv = process.env
) {
  return getJimengApiKeyCandidates(model, env)[0]?.value ?? "";
}

export function getJimengBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return firstTrimmedEnvValue(env, ["JIMENG_API_BASE_URL"]) || defaultJimengBaseUrl;
}

export function getJimengVideoModel(env: NodeJS.ProcessEnv = process.env) {
  const model = firstTrimmedEnvValue(env, ["JIMENG_VIDEO_MODEL"]);

  return isSeedanceVideoModel(model) ? model : defaultJimengVideoModel;
}

export function getJimengQueryUrlTemplate(env: NodeJS.ProcessEnv = process.env) {
  return firstTrimmedEnvValue(env, ["JIMENG_QUERY_URL_TEMPLATE"]);
}
