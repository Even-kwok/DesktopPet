export const seedanceFastModel = "doubao-seedance-2-0-fast-260128";
export const seedanceMiniModel = "doubao-seedance-2-0-mini-260615";
export const seedanceVideoModelValues = [seedanceFastModel, seedanceMiniModel] as const;

export type SeedanceVideoModel = (typeof seedanceVideoModelValues)[number];

export const defaultSeedanceVideoModel: SeedanceVideoModel = seedanceFastModel;

export const seedanceVideoModelOptions: Array<{
  value: SeedanceVideoModel;
  label: string;
  keyHint: string;
}> = [
  {
    value: seedanceFastModel,
    label: "Doubao-Seedance-2.0-fast",
    keyHint: "JIMENG_API_KEY / ARK_API_KEY"
  },
  {
    value: seedanceMiniModel,
    label: "Doubao-Seedance-2.0-mini",
    keyHint: "mini_API_KEY / JIMENG_API_KEY"
  }
];

export function isSeedanceVideoModel(value: unknown): value is SeedanceVideoModel {
  return seedanceVideoModelValues.some((model) => model === value);
}
