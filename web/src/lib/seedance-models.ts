export const seedanceMiniModel = "doubao-seed-2-0-mini-260428";
export const seedanceVideoModelValues = [seedanceMiniModel] as const;

export type SeedanceVideoModel = (typeof seedanceVideoModelValues)[number];

export const defaultSeedanceVideoModel: SeedanceVideoModel = seedanceMiniModel;

export const seedanceVideoModelOptions: Array<{
  value: SeedanceVideoModel;
  label: string;
  keyHint: string;
}> = [
  {
    value: seedanceMiniModel,
    label: "Doubao-Seed-2.0-mini",
    keyHint: "mini_API_KEY / ARK_API_KEY"
  }
];

export function isSeedanceVideoModel(value: unknown): value is SeedanceVideoModel {
  return seedanceVideoModelValues.some((model) => model === value);
}
