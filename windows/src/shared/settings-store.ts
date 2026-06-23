import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { clampPetSizeScale } from "./pet-action-slots.ts";
import type { PetActionSlot } from "./pet-action-slots.ts";

export type Rect = { x: number; y: number; width: number; height: number };

export type DesktopAccountSession = {
  id: string;
  name: string;
  email: string;
  credits: number;
  accessToken: string;
  signedInAt: string;
};

type PetSettings = {
  name?: string;
  sizeScale?: number;
  frame?: Rect;
  videos?: Partial<Record<PetActionSlot, string>>;
};

type SettingsData = {
  petCount?: number;
  isPetVisible?: boolean;
  isClickThrough?: boolean;
  isMouseoverCatchEnabled?: boolean;
  pets?: PetSettings[];
  currentAccount?: DesktopAccountSession;
};

const maxPetSize = { width: 150, height: 150 };

export class SettingsStore {
  readonly filePath: string;
  #data: SettingsData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.#data = this.#read();
  }

  get petCount() {
    return Math.max(0, this.#data.petCount ?? 1);
  }

  set petCount(count: number) {
    this.#data.petCount = Math.max(0, Math.trunc(count));
    this.#write();
  }

  get isPetVisible() {
    return this.#data.isPetVisible ?? false;
  }

  set isPetVisible(value: boolean) {
    this.#data.isPetVisible = value;
    this.#write();
  }

  get isClickThrough() {
    return this.#data.isClickThrough ?? false;
  }

  set isClickThrough(value: boolean) {
    this.#data.isClickThrough = value;
    this.#write();
  }

  get isMouseoverCatchEnabled() {
    return this.#data.isMouseoverCatchEnabled ?? true;
  }

  set isMouseoverCatchEnabled(value: boolean) {
    this.#data.isMouseoverCatchEnabled = value;
    this.#write();
  }

  get currentAccount() {
    return this.#data.currentAccount;
  }

  saveAccountSession(account: DesktopAccountSession) {
    this.#data.currentAccount = account;
    this.#write();
  }

  signOut() {
    delete this.#data.currentAccount;
    this.#write();
  }

  petName(index: number) {
    const name = this.#pet(index).name?.trim();
    return name ? name : `Pet ${index + 1}`;
  }

  setPetName(name: string, index: number) {
    const trimmed = name.trim();
    const pet = this.#pet(index);
    if (trimmed) {
      pet.name = trimmed;
    } else {
      delete pet.name;
    }
    this.#write();
  }

  petSizeScale(index: number) {
    return clampPetSizeScale(this.#pet(index).sizeScale ?? 1);
  }

  setPetSizeScale(scale: number, index: number) {
    const pet = this.#pet(index);
    pet.sizeScale = clampPetSizeScale(scale);
    pet.frame = applyPetSizeScale(this.petFrame(index), pet.sizeScale);
    this.#write();
  }

  petFrame(index: number, screenSize = { width: 1024, height: 768 }): Rect {
    const frame = this.#pet(index).frame;
    if (frame && frame.width > 0 && frame.height > 0) {
      return frame;
    }
    return applyPetSizeScale(defaultPetFrame(index, screenSize), this.petSizeScale(index));
  }

  setPetFrame(frame: Rect, index: number) {
    this.#pet(index).frame = frame;
    this.#write();
  }

  saveVideoPath(videoPath: string, slot: PetActionSlot, index: number) {
    const pet = this.#pet(index);
    pet.videos = { ...pet.videos, [slot]: videoPath };
    this.#write();
  }

  removeVideo(slot: PetActionSlot, index: number) {
    const pet = this.#pet(index);
    delete pet.videos?.[slot];
    this.#write();
  }

  restoreVideoPath(slot: PetActionSlot, index: number) {
    return this.#pet(index).videos?.[slot];
  }

  savedVideoSlots(index: number) {
    return Object.keys(this.#pet(index).videos ?? {}) as PetActionSlot[];
  }

  removePet(index: number) {
    if (index < 0 || index >= this.petCount) {
      return;
    }
    const pets = [...(this.#data.pets ?? [])];
    pets.splice(index, 1);
    this.#data.pets = pets;
    this.#data.petCount = Math.max(0, this.petCount - 1);
    this.#write();
  }

  #pet(index: number) {
    const pets = [...(this.#data.pets ?? [])];
    while (pets.length <= index) {
      pets.push({});
    }
    this.#data.pets = pets;
    return pets[index];
  }

  #read(): SettingsData {
    if (!existsSync(this.filePath)) {
      return {};
    }
    return JSON.parse(readFileSync(this.filePath, "utf8")) as SettingsData;
  }

  #write() {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.#data, null, 2));
  }
}

export function defaultPetFrame(index: number, screenSize: { width: number; height: number }): Rect {
  const columns = Math.max(1, Math.min(6, Math.trunc((screenSize.width - maxPetSize.width) / 42)));
  const column = Math.max(index, 0) % columns;
  const row = Math.trunc(Math.max(index, 0) / columns);

  return {
    x: screenSize.width / 2 - maxPetSize.width / 2 + column * 34,
    y: screenSize.height / 2 - maxPetSize.height / 2 - row * 34,
    width: maxPetSize.width,
    height: maxPetSize.height
  };
}

export function applyPetSizeScale(frame: Rect, scale: number): Rect {
  const clampedScale = clampPetSizeScale(scale);
  const width = maxPetSize.width * clampedScale;
  const height = maxPetSize.height * clampedScale;

  return {
    x: frame.x + frame.width / 2 - width / 2,
    y: frame.y + frame.height / 2 - height / 2,
    width,
    height
  };
}
