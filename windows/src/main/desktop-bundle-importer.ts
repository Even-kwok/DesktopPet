import type { PetColonyController } from "./pet-colony-controller.ts";
import type { SettingsStore } from "../shared/settings-store.ts";
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
  "petCount" | "setPetName" | "saveVideoPath" | "saveSyncedPetCards" | "isPetVisible"
>;

type DesktopBundleImportPetColonyController = Pick<
  PetColonyController,
  "setPetCount" | "refreshDisplayNames" | "showAll"
>;

type DownloadRemoteMaterial = (
  material: DesktopPetBundleMaterial,
  petID: string,
  remoteMaterialRoot: string
) => Promise<string>;

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
    throw DesktopPetSyncError.missingIdleLoop();
  }

  if (input.settingsStore.petCount < desktopPets.length) {
    input.petColonyController.setPetCount(desktopPets.length);
  }

  let materialCount = 0;
  const download = input.downloadRemoteMaterial ?? downloadRemoteMaterial;
  for (const [petIndex, pet] of desktopPets.entries()) {
    input.settingsStore.setPetName(pet.name, petIndex);

    for (const material of readyDesktopMaterials(pet)) {
      const videoPath = await download(material, pet.id, input.remoteMaterialRoot);
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
    petCount: desktopPets.length,
    materialCount
  };
}

export async function downloadRemoteMaterial(
  material: DesktopPetBundleMaterial,
  petID: string,
  remoteMaterialRoot: string
) {
  const response = await fetch(material.videoUrl);
  if (!response.ok) {
    throw DesktopPetSyncError.invalidResponse();
  }

  const destination = remoteMaterialDestinationPath(remoteMaterialRoot, petID, material);
  await writeRemoteMaterialAtomically(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}
