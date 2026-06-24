import path from "node:path";

export function resolveRuntimePaths(currentDir: string, rendererURL?: string) {
  return {
    preloadPath: path.join(currentDir, "../preload/index.cjs"),
    studioRendererFile: path.join(currentDir, "../renderer/index.html"),
    petRendererFile: path.join(currentDir, "../renderer/pet.html"),
    studioRendererURL: rendererURL ? rendererEntryURL(rendererURL, "index.html") : undefined,
    petRendererURL: rendererURL ? rendererEntryURL(rendererURL, "pet.html") : undefined
  };
}

function rendererEntryURL(rendererURL: string, entryFile: "index.html" | "pet.html") {
  return new URL(`src/renderer/${entryFile}`, withTrailingSlash(rendererURL)).toString();
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
