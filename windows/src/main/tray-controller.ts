import {
  allPetActionSlots,
  petActionSlotDisplayName,
  petSizeScaleOptions
} from "../shared/pet-action-slots.ts";
import type { PetActionSlot } from "../shared/pet-action-slots.ts";

export type MenuTemplateItem = {
  label?: string;
  type?: "separator" | "normal" | "checkbox";
  checked?: boolean;
  enabled?: boolean;
  submenu?: MenuTemplateItem[];
  action?: string;
  payload?: unknown;
};

export type BoundMenuTemplateItem = Omit<MenuTemplateItem, "submenu"> & {
  submenu?: BoundMenuTemplateItem[];
  click?: () => void;
};

export type MenuActionHandlers = Record<string, (payload: unknown) => void>;

export type TrayMenuState = {
  petCount: number;
  isVisible: boolean;
  isClickThrough: boolean;
  isMouseoverCatchEnabled: boolean;
  petName: (petIndex: number) => string;
  hasVideo: (slot: PetActionSlot, petIndex: number) => boolean;
  petSizeScale: (petIndex: number) => number;
};

export type VisibilityResultAfterShowingPets =
  | { isPetVisible: true; importIdleLoop: false }
  | { isPetVisible: false; importIdleLoop: true; petIndex: 0; slot: "idle_loop" };

export function buildTrayMenuTemplate(state: TrayMenuState): MenuTemplateItem[] {
  return [
    { label: "打开素材工作台", action: "openStudio" },
    { type: "separator" },
    {
      label: "选择状态视频",
      submenu: petSubmenus(state, (petIndex) => chooseStateVideoSubmenu(state, petIndex))
    },
    {
      label: "删除状态视频",
      submenu: petSubmenus(state, (petIndex) => removeStateVideoSubmenu(state, petIndex))
    },
    {
      label: "宠物",
      submenu: petsSubmenu(state)
    },
    {
      label: state.isVisible ? "隐藏宠物" : "显示宠物",
      action: "toggleVisibility"
    },
    {
      label: "切换点击穿透",
      type: "checkbox",
      checked: state.isClickThrough,
      action: "toggleClickThrough"
    },
    {
      label: "切换鼠标经过抓虫",
      type: "checkbox",
      checked: state.isMouseoverCatchEnabled,
      action: "toggleMouseoverCatch"
    },
    { label: "重置位置", action: "resetPositions" },
    { type: "separator" },
    { label: "退出", action: "quit" }
  ];
}

export function visibilityResultAfterShowingPets(didShowAnyPet: boolean): VisibilityResultAfterShowingPets {
  if (didShowAnyPet) {
    return { isPetVisible: true, importIdleLoop: false };
  }

  return { isPetVisible: false, importIdleLoop: true, petIndex: 0, slot: "idle_loop" };
}

export function bindMenuActions(
  template: MenuTemplateItem[],
  handlers: MenuActionHandlers
): BoundMenuTemplateItem[] {
  return template.map((item) => {
    const boundItem: BoundMenuTemplateItem = {
      ...item,
      submenu: item.submenu ? bindMenuActions(item.submenu, handlers) : undefined
    };

    const action = item.action;
    if (action) {
      boundItem.click = () => handlers[action]?.(item.payload);
    }

    return boundItem;
  });
}

function petSubmenus(
  state: TrayMenuState,
  buildSubmenu: (petIndex: number) => MenuTemplateItem[]
): MenuTemplateItem[] {
  return Array.from({ length: state.petCount }, (_, petIndex) => ({
    label: state.petName(petIndex),
    submenu: buildSubmenu(petIndex)
  }));
}

function chooseStateVideoSubmenu(state: TrayMenuState, petIndex: number): MenuTemplateItem[] {
  return allPetActionSlots.map((slot) => ({
    label: petActionSlotDisplayName(slot),
    type: "checkbox",
    checked: state.hasVideo(slot, petIndex),
    action: "chooseStateVideo",
    payload: { petIndex, slot }
  }));
}

function removeStateVideoSubmenu(state: TrayMenuState, petIndex: number): MenuTemplateItem[] {
  return allPetActionSlots.map((slot) => {
    const hasVideo = state.hasVideo(slot, petIndex);
    return {
      label: petActionSlotDisplayName(slot),
      type: "checkbox",
      checked: hasVideo,
      enabled: hasVideo,
      action: "removeStateVideo",
      payload: { petIndex, slot }
    };
  });
}

function petsSubmenu(state: TrayMenuState): MenuTemplateItem[] {
  return [
    {
      label: `当前宠物数：${state.petCount}`,
      enabled: false
    },
    { type: "separator" },
    { label: "添加宠物", action: "addPet" },
    {
      label: "重命名宠物",
      enabled: state.petCount > 0,
      submenu: petActionSubmenu(state, "renamePet")
    },
    {
      label: "调整大小",
      enabled: state.petCount > 0,
      submenu: Array.from({ length: state.petCount }, (_, petIndex) => ({
        label: state.petName(petIndex),
        submenu: petSizeSubmenu(state, petIndex)
      }))
    },
    {
      label: "删除宠物",
      enabled: state.petCount > 0,
      submenu: petActionSubmenu(state, "removePet")
    }
  ];
}

function petActionSubmenu(state: TrayMenuState, action: string): MenuTemplateItem[] {
  return Array.from({ length: state.petCount }, (_, petIndex) => ({
    label: state.petName(petIndex),
    action,
    payload: { petIndex }
  }));
}

function petSizeSubmenu(state: TrayMenuState, petIndex: number): MenuTemplateItem[] {
  const currentScale = state.petSizeScale(petIndex);
  return petSizeScaleOptions.map((scale) => ({
    label: scale === 1 ? "最大 100%" : `${Math.round(scale * 100)}%`,
    type: "checkbox",
    checked: Math.abs(currentScale - scale) < 0.001,
    action: "setPetSize",
    payload: { petIndex, scale }
  }));
}
