import { access, readFile, writeFile } from "node:fs/promises";
import type { PetColonyController } from "./pet-colony-controller.ts";
import type { SettingsStore } from "../shared/settings-store.ts";
import { allPetActionSlots } from "../shared/pet-action-slots.ts";
import { remoteMaterialDestinationPath, writeRemoteMaterialAtomically } from "../shared/remote-material-cache.ts";
import {
  DesktopPetSyncError,
  displayablePets,
  readyDesktopMaterials,
  syncedPetCardsFromBundle
} from "../shared/desktop-sync-client.ts";
import type {
  DesktopPetBundle,
  DesktopPetBundleMaterial
} from "../shared/desktop-sync-client.ts";

type DesktopBundleImportSettingsStore = Pick<
  SettingsStore,
  "petCount" | "setPetName" | "saveVideoPath" | "removeVideo" | "saveSyncedPetCards" | "isPetVisible"
>;

type DesktopBundleImportPetColonyController = Pick<
  PetColonyController,
  "setPetCount" | "refreshDisplayNames" | "showAll" | "hideAll"
>;

type DownloadRemoteMaterial = (
  material: DesktopPetBundleMaterial,
  petID: string,
  remoteMaterialRoot: string
) => Promise<string>;

type DownloadRemoteMaterialDependencies = {
  fetchImpl?: typeof fetch;
};

type ImportedDesktopPet = {
  pet: DesktopPetBundle["pets"][number];
  materials: Array<{
    material: DesktopPetBundleMaterial;
    videoPath: string;
  }>;
};

export async function importDesktopBundle(
  bundle: DesktopPetBundle,
  input: {
    settingsStore: DesktopBundleImportSettingsStore;
    petColonyController: DesktopBundleImportPetColonyController;
    remoteMaterialRoot: string;
    downloadRemoteMaterial?: DownloadRemoteMaterial;
  }
) {
  input.settingsStore.saveSyncedPetCards(syncedPetCardsFromBundle(bundle));

  const petsWithMaterials = bundle.pets.filter((pet) => pet.materials.length > 0);
  if (petsWithMaterials.length === 0) {
    throw DesktopPetSyncError.emptyBundle();
  }

  const desktopPets = displayablePets(bundle);
  if (desktopPets.length === 0) {
    if (petsWithMaterials.some((pet) => isActiveDesktopPet(pet) && !hasReadyIdleLoop(pet))) {
      throw DesktopPetSyncError.missingIdleLoop();
    }

    input.petColonyController.setPetCount(0);
    input.settingsStore.isPetVisible = false;
    input.petColonyController.hideAll();
    input.petColonyController.refreshDisplayNames();

    return {
      petCount: 0,
      materialCount: 0
    };
  }

  const download = input.downloadRemoteMaterial ?? downloadRemoteMaterial;
  const importedPets: ImportedDesktopPet[] = [];
  const idleLoopErrors: unknown[] = [];

  for (const pet of desktopPets) {
    const idleLoopMaterial = readyDesktopMaterials(pet).find((material) => material.slot === "idle_loop");
    if (!idleLoopMaterial) {
      continue;
    }

    try {
      const idleLoopVideoPath = await download(idleLoopMaterial, pet.id, input.remoteMaterialRoot);
      const importedMaterials: ImportedDesktopPet["materials"] = [
        { material: idleLoopMaterial, videoPath: idleLoopVideoPath }
      ];

      for (const material of readyDesktopMaterials(pet)) {
        if (material.slot === "idle_loop") {
          continue;
        }

        try {
          const videoPath = await download(material, pet.id, input.remoteMaterialRoot);
          importedMaterials.push({ material, videoPath });
        } catch {}
      }

      importedPets.push({ pet, materials: importedMaterials });
    } catch (error) {
      idleLoopErrors.push(error);
    }
  }

  if (importedPets.length === 0) {
    throw idleLoopErrors[0] instanceof Error ? idleLoopErrors[0] : DesktopPetSyncError.emptyBundle();
  }

  input.petColonyController.setPetCount(importedPets.length);

  let materialCount = 0;
  for (const [petIndex, importedPet] of importedPets.entries()) {
    input.settingsStore.setPetName(importedPet.pet.name, petIndex);
    for (const slot of allPetActionSlots) {
      input.settingsStore.removeVideo(slot, petIndex);
    }

    for (const { material, videoPath } of importedPet.materials) {
      input.settingsStore.saveVideoPath(videoPath, material.slot, petIndex);
      materialCount += 1;
    }
  }

  if (materialCount === 0) {
    throw DesktopPetSyncError.emptyBundle();
  }

  input.settingsStore.isPetVisible = true;
  input.petColonyController.refreshDisplayNames();
  input.petColonyController.showAll();

  return {
    petCount: importedPets.length,
    materialCount
  };
}

function isActiveDesktopPet(pet: DesktopPetBundle["pets"][number]) {
  const displayState = pet.displayState ?? "active";
  return displayState !== "unavailable" && displayState !== "hidden";
}

function hasReadyIdleLoop(pet: DesktopPetBundle["pets"][number]) {
  return readyDesktopMaterials(pet).some((material) => material.slot === "idle_loop");
}

export async function downloadRemoteMaterial(
  material: DesktopPetBundleMaterial,
  petID: string,
  remoteMaterialRoot: string,
  dependencies: DownloadRemoteMaterialDependencies = {}
) {
  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, petID, material);
  if (await canReuseCachedRemoteMaterial(destination, material.videoUrl)) {
    return destination;
  }

  const response = await (dependencies.fetchImpl ?? fetch)(material.videoUrl);
  if (!response.ok) {
    throw DesktopPetSyncError.invalidResponse();
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (looksInvalidRemoteMaterial(bytes, response.headers.get("content-type"))) {
    throw DesktopPetSyncError.invalidResponse();
  }

  await writeRemoteMaterialAtomically(destination, bytes);
  await writeRemoteMaterialMetadata(destination, material.videoUrl);
  return destination;
}

async function canReuseCachedRemoteMaterial(destination: string, videoUrl: string) {
  try {
    await access(destination);
    const cachedURL = await readFile(remoteMaterialMetadataPath(destination), "utf8");
    if (cachedURL !== videoUrl) {
      return false;
    }

    const cachedBytes = await readFile(destination);
    return !looksInvalidRemoteMaterial(cachedBytes);
  } catch {
    return false;
  }
}

function looksInvalidRemoteMaterial(bytes: Uint8Array, contentType?: string | null) {
  const normalizedContentType = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalizedContentType?.startsWith("image/") || normalizedContentType === "text/html") {
    return true;
  }

  const prefix = Buffer.from(bytes.subarray(0, 256)).toString("utf8").trimStart().toLowerCase();
  return prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.startsWith("<svg") ||
    looksLikeImageBytes(bytes);
}

function looksLikeImageBytes(bytes: Uint8Array) {
  return hasBytePrefix(bytes, [0x89, 0x50, 0x4e, 0x47]) ||
    hasBytePrefix(bytes, [0xff, 0xd8, 0xff]) ||
    hasBytePrefix(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    hasBytePrefix(bytes, [0x42, 0x4d]) ||
    (hasBytePrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50);
}

function hasBytePrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

async function writeRemoteMaterialMetadata(destination: string, videoUrl: string) {
  try {
    await writeFile(remoteMaterialMetadataPath(destination), videoUrl, "utf8");
  } catch {}
}

function remoteMaterialMetadataPath(destination: string) {
  return `${destination}.url`;
}
