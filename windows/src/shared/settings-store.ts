import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allPetActionSlots, clampPetSizeScale } from "./pet-action-slots.ts";
import type { DesktopFriendCard, DesktopSyncAccount } from "./desktop-sync-client.ts";
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

export type DesktopSyncedPetCard = {
  id: string;
  petNumber: string;
  name: string;
  ownership: string;
  displayState: string;
  avatarUrl?: string | null;
  materialCount: number;
};

export function refreshedAccountSessionFromSyncAccount(
  currentAccount: DesktopAccountSession,
  syncAccount: DesktopSyncAccount | null | undefined
) {
  if (!syncAccount) {
    return currentAccount;
  }

  return {
    id: syncAccount.id,
    name: syncAccount.name,
    email: syncAccount.email,
    credits: syncAccount.credits,
    accessToken: currentAccount.accessToken,
    signedInAt: currentAccount.signedInAt
  };
}

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
  syncedPetCards?: DesktopSyncedPetCard[];
  selectedSyncedPetID?: string;
  friendCards?: DesktopFriendCard[];
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
    return normalizedPetCount(this.#data.petCount, 1);
  }

  set petCount(count: number) {
    this.#data.petCount = normalizedPetCount(count, 0);
    this.#write();
  }

  get isPetVisible() {
    return booleanOrDefault(this.#data.isPetVisible, false);
  }

  set isPetVisible(value: boolean) {
    this.#data.isPetVisible = value;
    this.#write();
  }

  get isClickThrough() {
    return booleanOrDefault(this.#data.isClickThrough, false);
  }

  set isClickThrough(value: boolean) {
    this.#data.isClickThrough = value;
    this.#write();
  }

  get isMouseoverCatchEnabled() {
    return booleanOrDefault(this.#data.isMouseoverCatchEnabled, true);
  }

  set isMouseoverCatchEnabled(value: boolean) {
    this.#data.isMouseoverCatchEnabled = value;
    this.#write();
  }

  get currentAccount() {
    return isDesktopAccountSession(this.#data.currentAccount) ? this.#data.currentAccount : undefined;
  }

  saveAccountSession(account: DesktopAccountSession) {
    this.#data.currentAccount = account;
    this.#write();
  }

  signOut() {
    delete this.#data.currentAccount;
    this.#write();
  }

  get syncedPetCards() {
    return Array.isArray(this.#data.syncedPetCards)
      ? this.#data.syncedPetCards.filter(isDesktopSyncedPetCard)
      : [];
  }

  saveSyncedPetCards(cards: DesktopSyncedPetCard[]) {
    this.#data.syncedPetCards = cards;
    if (cards.length === 0) {
      delete this.#data.selectedSyncedPetID;
    } else if (!cards.some((card) => card.id === this.#data.selectedSyncedPetID)) {
      this.#data.selectedSyncedPetID = cards[0].id;
    }
    this.#write();
  }

  get selectedSyncedPetID() {
    const selectedPetID =
      typeof this.#data.selectedSyncedPetID === "string"
        ? this.#data.selectedSyncedPetID
        : undefined;
    const cards = this.syncedPetCards;
    if (selectedPetID && cards.some((card) => card.id === selectedPetID)) {
      return selectedPetID;
    }

    return cards[0]?.id;
  }

  set selectedSyncedPetID(petID: string | undefined) {
    if (petID) {
      this.#data.selectedSyncedPetID = petID;
    } else {
      delete this.#data.selectedSyncedPetID;
    }
    this.#write();
  }

  markSyncedPetRecalled(petID: string) {
    this.#data.syncedPetCards = this.syncedPetCards.map((card) =>
      card.id === petID ? { ...card, displayState: "active", ownership: "owned" } : card
    );
    this.#write();
  }

  get friendCards() {
    return Array.isArray(this.#data.friendCards)
      ? this.#data.friendCards.filter(isDesktopFriendCard)
      : [];
  }

  saveFriendCards(cards: DesktopFriendCard[]) {
    this.#data.friendCards = cards;
    this.#write();
  }

  upsertFriendCard(card: DesktopFriendCard) {
    const cards = this.friendCards.filter((friend) => friend.id !== card.id);
    cards.push(card);
    this.#data.friendCards = cards;
    this.#write();
  }

  removeFriendCard(friendID: string) {
    this.#data.friendCards = this.friendCards.filter((friend) => friend.id !== friendID);
    this.#write();
  }

  clearFriendCards() {
    delete this.#data.friendCards;
    this.#write();
  }

  petName(index: number) {
    const rawName = this.#pet(index).name;
    const name = typeof rawName === "string" ? rawName.trim() : "";
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
    const rawScale = this.#pet(index).sizeScale;
    return clampPetSizeScale(typeof rawScale === "number" ? rawScale : 1);
  }

  setPetSizeScale(scale: number, index: number) {
    const pet = this.#pet(index);
    pet.sizeScale = clampPetSizeScale(scale);
    pet.frame = applyPetSizeScale(this.petFrame(index), pet.sizeScale);
    this.#write();
  }

  petFrame(index: number, screenSize = { width: 1024, height: 768 }): Rect {
    const frame = this.#pet(index).frame;
    if (isRect(frame)) {
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
    const videos = isRecord(pet.videos) ? pet.videos : {};
    pet.videos = { ...videos, [slot]: videoPath };
    this.#write();
  }

  removeVideo(slot: PetActionSlot, index: number) {
    const pet = this.#pet(index);
    delete pet.videos?.[slot];
    this.#write();
  }

  restoreVideoPath(slot: PetActionSlot, index: number) {
    const videos = this.#pet(index).videos;
    const videoPath = isRecord(videos) && typeof videos[slot] === "string" ? videos[slot] : undefined;
    return videoPath && existsSync(videoPath) ? videoPath : undefined;
  }

  savedVideoSlots(index: number) {
    const videos = this.#pet(index).videos;
    return isRecord(videos)
      ? allPetActionSlots.filter((slot) => typeof videos[slot] === "string")
      : [];
  }

  availableVideoSlots(index: number) {
    return allPetActionSlots.filter((slot) => this.restoreVideoPath(slot, index) !== undefined);
  }

  removePet(index: number) {
    if (!isExistingPetIndex(index, this.petCount)) {
      return;
    }
    const pets = [...(this.#data.pets ?? [])];
    pets.splice(index, 1);
    this.#data.pets = pets;
    this.#data.petCount = Math.max(0, this.petCount - 1);
    this.#write();
  }

  #pet(index: number) {
    const pets = Array.isArray(this.#data.pets) ? [...this.#data.pets] : [];
    while (pets.length <= index) {
      pets.push({});
    }
    if (!isRecord(pets[index])) {
      pets[index] = {};
    }
    this.#data.pets = pets;
    return pets[index];
  }

  #read(): SettingsData {
    if (!existsSync(this.filePath)) {
      return {};
    }
    try {
      const data = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
      return isRecord(data) ? (data as SettingsData) : {};
    } catch {
      return {};
    }
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

function normalizedPetCount(count: unknown, fallback: number) {
  return typeof count === "number" && Number.isFinite(count)
    ? Math.max(0, Math.trunc(count))
    : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function isRect(value: unknown): value is Rect {
  if (!isRecord(value)) {
    return false;
  }

  const { x, y, width, height } = value;
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    width > 0 &&
    height > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDesktopAccountSession(value: unknown): value is DesktopAccountSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.email) &&
    isInteger(value.credits) &&
    isString(value.accessToken) &&
    isString(value.signedInAt)
  );
}

function isDesktopSyncedPetCard(value: unknown): value is DesktopSyncedPetCard {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.petNumber) &&
    isString(value.name) &&
    isString(value.ownership) &&
    isString(value.displayState) &&
    isOptionalString(value.avatarUrl) &&
    isInteger(value.materialCount)
  );
}

function isDesktopFriendCard(value: unknown): value is DesktopFriendCard {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.status) &&
    isInteger(value.hostedPets)
  );
}

function isString(value: unknown) {
  return typeof value === "string";
}

function isOptionalString(value: unknown) {
  return value === undefined || value === null || isString(value);
}

function isInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isExistingPetIndex(index: number, petCount: number) {
  return Number.isInteger(index) && index >= 0 && index < petCount;
}
