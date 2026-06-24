export type PetActionSlot =
  | "idle_loop"
  | "catch_bug"
  | "catch_bug_up"
  | "click_react"
  | "head_rub_left"
  | "head_rub_right"
  | "angry_swipe_left"
  | "angry_swipe_right"
  | "yawn"
  | "lick_belly"
  | "lick_back"
  | "stretch"
  | "happy"
  | "disgusted"
  | "full_wash_face"
  | "hungry_meow"
  | "clingy"
  | "aloof"
  | "belly_up"
  | "look_at_camera"
  | "salary_cat_stinky_dance"
  | "head_bob_dance"
  | "drag_loop"
  | "sleep_loop";

export type VisiblePetActionSlot = Exclude<PetActionSlot, "drag_loop">;
export type PetInteractionSide = "left" | "right";
export type PetMaterialGroup = "core" | "pointer" | "nearbyPet" | "idleLife" | "feeding" | "reserved";

export const allPetActionSlots: VisiblePetActionSlot[] = [
  "idle_loop",
  "catch_bug",
  "catch_bug_up",
  "click_react",
  "head_rub_left",
  "head_rub_right",
  "angry_swipe_left",
  "angry_swipe_right",
  "yawn",
  "lick_belly",
  "lick_back",
  "stretch",
  "happy",
  "disgusted",
  "full_wash_face",
  "hungry_meow",
  "clingy",
  "aloof",
  "belly_up",
  "look_at_camera",
  "salary_cat_stinky_dance",
  "head_bob_dance",
  "sleep_loop"
];

const displayNames: Record<PetActionSlot, string> = {
  idle_loop: "待机循环",
  catch_bug: "鼠标经过抓虫子",
  catch_bug_up: "双手抓上方虫子",
  click_react: "点击反应",
  head_rub_left: "左边头蹭蹭",
  head_rub_right: "右边头蹭蹭",
  angry_swipe_left: "向左看生气挥一下爪子",
  angry_swipe_right: "向右看生气挥一下爪子",
  yawn: "打哈欠",
  lick_belly: "舔肚子的毛",
  lick_back: "舔背部的毛",
  stretch: "伸懒腰",
  happy: "开心",
  disgusted: "嫌弃",
  full_wash_face: "吃饱满足洗脸",
  hungry_meow: "饿了嗷嗷叫",
  clingy: "粘人",
  aloof: "高冷",
  belly_up: "躺下翻肚皮",
  look_at_camera: "看镜头",
  salary_cat_stinky_dance: "跳月薪喵散屁舞",
  head_bob_dance: "摇头晃脑舞",
  drag_loop: "拖拽循环（备用）",
  sleep_loop: "睡觉"
};

const triggerDescriptions: Record<PetActionSlot, string> = {
  idle_loop: "默认循环",
  sleep_loop: "长时间无操作",
  catch_bug: "鼠标经过宠物",
  catch_bug_up: "鼠标经过宠物",
  click_react: "点击宠物",
  head_rub_left: "另一只宠物靠近",
  head_rub_right: "另一只宠物靠近",
  angry_swipe_left: "另一只宠物靠近",
  angry_swipe_right: "另一只宠物靠近",
  yawn: "待机随机",
  lick_belly: "待机随机",
  lick_back: "待机随机",
  stretch: "待机随机",
  happy: "待机随机",
  disgusted: "待机随机",
  full_wash_face: "吃饱后触发",
  hungry_meow: "饥饿时触发",
  clingy: "待机随机",
  aloof: "待机随机",
  belly_up: "待机随机",
  look_at_camera: "待机随机",
  salary_cat_stinky_dance: "待机随机",
  head_bob_dance: "待机随机",
  drag_loop: "备用"
};

export const mouseoverCatchSlots: VisiblePetActionSlot[] = ["catch_bug", "catch_bug_up"];

export const clickReactionSlots: VisiblePetActionSlot[] = [
  "click_react",
  "happy",
  "disgusted",
  "clingy",
  "aloof",
  "belly_up"
];

export const idleRandomActionSlots: VisiblePetActionSlot[] = [
  "yawn",
  "lick_belly",
  "lick_back",
  "stretch",
  "happy",
  "disgusted",
  "full_wash_face",
  "hungry_meow",
  "clingy",
  "aloof",
  "belly_up",
  "look_at_camera",
  "salary_cat_stinky_dance",
  "head_bob_dance"
];

export function petActionSlotDisplayName(slot: PetActionSlot) {
  return displayNames[slot];
}

export function petActionSlotTriggerDescription(slot: PetActionSlot) {
  return triggerDescriptions[slot];
}

export function nearbyPetInteractionSlots(side: PetInteractionSide): VisiblePetActionSlot[] {
  return side === "left"
    ? ["head_rub_left", "angry_swipe_left"]
    : ["head_rub_right", "angry_swipe_right"];
}

export function matchingNearbyResponseSlot(slot: PetActionSlot): VisiblePetActionSlot | undefined {
  switch (slot) {
    case "head_rub_left":
      return "head_rub_right";
    case "head_rub_right":
      return "head_rub_left";
    case "angry_swipe_left":
      return "angry_swipe_right";
    case "angry_swipe_right":
      return "angry_swipe_left";
    default:
      return undefined;
  }
}

export function materialGroupForSlot(slot: PetActionSlot): PetMaterialGroup {
  switch (slot) {
    case "idle_loop":
    case "sleep_loop":
      return "core";
    case "click_react":
    case "catch_bug":
    case "catch_bug_up":
      return "pointer";
    case "head_rub_left":
    case "head_rub_right":
    case "angry_swipe_left":
    case "angry_swipe_right":
      return "nearbyPet";
    case "yawn":
    case "lick_belly":
    case "lick_back":
    case "stretch":
    case "happy":
    case "disgusted":
    case "clingy":
    case "aloof":
    case "belly_up":
    case "look_at_camera":
    case "salary_cat_stinky_dance":
    case "head_bob_dance":
      return "idleLife";
    case "full_wash_face":
    case "hungry_meow":
      return "feeding";
    case "drag_loop":
      return "reserved";
  }
}

export const petSizeScaleOptions = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3] as const;
export const minPetSizeScale = 0.3;
export const maxPetSizeScale = 1;

export function clampPetSizeScale(scale: number) {
  if (!Number.isFinite(scale)) {
    return maxPetSizeScale;
  }

  return Math.min(maxPetSizeScale, Math.max(minPetSizeScale, scale));
}
