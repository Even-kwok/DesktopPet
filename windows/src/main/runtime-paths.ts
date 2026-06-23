import path from "node:path";

export function resolveRuntimePaths(currentDir: string, rendererURL?: string) {
  return {
    preloadPath: path.join(currentDir, "../preload/index.mjs"),
    studioRendererFile: path.join(currentDir, "../renderer/index.html"),
    petRendererFile: path.join(currentDir, "../renderer/pet.html"),
    rendererURL
  };
}
