import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DesktopPetBundleMaterial } from "./desktop-sync-client.ts";
import { safeRemoteMaterialPathComponent } from "./desktop-sync-client.ts";

type AtomicWriteDependencies = {
  mkdir?: typeof mkdir;
  writeFile?: typeof writeFile;
  rename?: typeof rename;
  rm?: typeof rm;
  tempSuffix?: () => string;
};

export function remoteMaterialDestinationPath(
  remoteMaterialRoot: string,
  petID: string,
  material: DesktopPetBundleMaterial
) {
  return path.join(
    remoteMaterialRoot,
    safeRemoteMaterialPathComponent(petID),
    `${material.slot}${materialFileExtension(material.videoUrl)}`
  );
}

export async function writeRemoteMaterialAtomically(
  destination: string,
  data: Uint8Array,
  dependencies: AtomicWriteDependencies = {}
) {
  const mkdirDependency = dependencies.mkdir ?? mkdir;
  const writeFileDependency = dependencies.writeFile ?? writeFile;
  const renameDependency = dependencies.rename ?? rename;
  const rmDependency = dependencies.rm ?? rm;
  const directory = path.dirname(destination);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(destination)}.${dependencies.tempSuffix?.() ?? `${process.pid}-${Date.now()}`}.tmp`
  );

  await mkdirDependency(directory, { recursive: true });

  try {
    await writeFileDependency(temporaryPath, data);
    await renameDependency(temporaryPath, destination);
  } catch (error) {
    await rmDependency(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

export function materialFileExtension(videoUrl: string) {
  try {
    const extension = path.extname(new URL(videoUrl).pathname);
    return extension || ".mp4";
  } catch {
    return path.extname(videoUrl) || ".mp4";
  }
}
