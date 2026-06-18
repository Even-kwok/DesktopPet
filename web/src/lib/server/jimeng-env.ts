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

export function getJimengApiKey(
  model: SeedanceVideoModel = defaultJimengVideoModel,
  env: NodeJS.ProcessEnv = process.env
) {
  if (model === seedanceFastModel) {
    return firstTrimmedEnvValue(env, [
      "SEEDANCE_FAST_API_KEY",
      "JIMENG_FAST_API_KEY",
      "FAST_API_KEY",
      "JIMENG_API_KEY",
      "ARK_API_KEY",
      "mini_API_KEY",
      "MINI_API_KEY"
    ]);
  }

  if (model === seedanceMiniModel) {
    return firstTrimmedEnvValue(env, [
      "mini_API_KEY",
      "MINI_API_KEY",
      "SEEDANCE_MINI_API_KEY",
      "JIMENG_MINI_API_KEY",
      "JIMENG_API_KEY",
      "ARK_API_KEY"
    ]);
  }

  return "";
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
