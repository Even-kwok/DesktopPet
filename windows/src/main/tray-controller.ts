import {
  allPetActionSlots,
  petActionSlotDisplayName,
  petSizeScaleOptions
} from "../shared/pet-action-slots.ts";
import type { PetActionSlot } from "../shared/pet-action-slots.ts";

export {
  showPetsActionPlan as visibilityResultAfterShowingPets
} from "./pet-visibility-policy.ts";
export type {
  ShowPetsActionPlan as VisibilityResultAfterShowingPets
} from "./pet-visibility-policy.ts";

export type MenuTemplateItem = {
  label?: string;
  type?: "separator" | "normal" | "checkbox";
  icon?: unknown;
  checked?: boolean;
  enabled?: boolean;
  accelerator?: string;
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
  petIcon?: (petIndex: number) => unknown;
  hasVideo: (slot: PetActionSlot, petIndex: number) => boolean;
  petSizeScale: (petIndex: number) => number;
};

export function buildTrayMenuTemplate(state: TrayMenuState): MenuTemplateItem[] {
  const normalizedState = {
    ...state,
    petCount: normalizedPetCount(state.petCount)
  };

  return [
    { label: "打开素材工作台", accelerator: "CommandOrControl+,", action: "openStudio" },
    { type: "separator" },
    {
      label: "选择状态视频",
      submenu: petSubmenus(normalizedState, (petIndex) => chooseStateVideoSubmenu(normalizedState, petIndex))
    },
    {
      label: "删除状态视频",
      submenu: petSubmenus(normalizedState, (petIndex) => removeStateVideoSubmenu(normalizedState, petIndex))
    },
    {
      label: "宠物",
      submenu: petsSubmenu(normalizedState)
    },
    {
      label: state.isVisible ? "隐藏宠物" : "显示宠物",
      accelerator: "CommandOrControl+S",
      action: "toggleVisibility"
    },
    {
      label: "切换点击穿透",
      type: "checkbox",
      checked: state.isClickThrough,
      accelerator: "CommandOrControl+T",
      action: "toggleClickThrough"
    },
    {
      label: "切换鼠标经过抓虫",
      type: "checkbox",
      checked: state.isMouseoverCatchEnabled,
      accelerator: "CommandOrControl+W",
      action: "toggleMouseoverCatch"
    },
    { label: "重置位置", accelerator: "CommandOrControl+R", action: "resetPositions" },
    { type: "separator" },
    { label: "退出", accelerator: "CommandOrControl+Q", action: "quit" }
  ];
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

export function resetPositionsActionPlan() {
  return {
    refreshTray: true
  };
}

function petSubmenus(
  state: TrayMenuState,
  buildSubmenu: (petIndex: number) => MenuTemplateItem[]
): MenuTemplateItem[] {
  return Array.from({ length: state.petCount }, (_, petIndex) =>
    petMenuItem(state, petIndex, { submenu: buildSubmenu(petIndex) })
  );
}

function chooseStateVideoSubmenu(state: TrayMenuState, petIndex: number): MenuTemplateItem[] {
  return allPetActionSlots.map((slot) => ({
    label: petActionSlotDisplayName(slot),
    type: "checkbox",
    checked: state.hasVideo(slot, petIndex),
    accelerator: petIndex === 0 && slot === "idle_loop" ? "CommandOrControl+O" : undefined,
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
    { label: "添加宠物", accelerator: "CommandOrControl+N", action: "addPet" },
    {
      label: "重命名宠物",
      enabled: state.petCount > 0,
      submenu: petActionSubmenu(state, "renamePet")
    },
    {
      label: "调整大小",
      enabled: state.petCount > 0,
      submenu: Array.from({ length: state.petCount }, (_, petIndex) => ({
        ...petMenuItem(state, petIndex),
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
  return Array.from({ length: state.petCount }, (_, petIndex) =>
    petMenuItem(state, petIndex, { action, payload: { petIndex } })
  );
}

function petMenuItem(
  state: TrayMenuState,
  petIndex: number,
  item: MenuTemplateItem = {}
): MenuTemplateItem {
  const icon = state.petIcon?.(petIndex);
  return {
    label: state.petName(petIndex),
    ...(icon === undefined ? {} : { icon }),
    ...item
  };
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

function normalizedPetCount(petCount: unknown) {
  return typeof petCount === "number" && Number.isFinite(petCount)
    ? Math.max(0, Math.trunc(petCount))
    : 0;
}
