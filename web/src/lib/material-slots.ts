export type MaterialGroupId =
  | "core"
  | "pointer"
  | "nearbyPet"
  | "idleLife"
  | "feeding"
  | "reserved";

export type MaterialUnlockTier = "basic" | "advanced" | "custom";

export type MaterialSlot = {
  id: string;
  name: string;
  trigger: string;
  cost: number;
  durationSeconds: number;
  group: MaterialGroupId;
  icon: string;
  unlockTier: MaterialUnlockTier;
};

export type MaterialGroup = {
  id: MaterialGroupId;
  title: string;
  description: string;
  color: string;
};

const deprecatedMaterialSlotIds = new Set(["drag_loop"]);

export function isDeprecatedMaterialSlotId(slot: string) {
  return deprecatedMaterialSlotIds.has(slot);
}

export const materialGroups: MaterialGroup[] = [
  {
    id: "core",
    title: "基础状态",
    description: "宠物默认展示和睡觉等基础素材。",
    color: "sky"
  },
  {
    id: "pointer",
    title: "鼠标互动",
    description: "用户点击或鼠标经过时触发。",
    color: "accent"
  },
  {
    id: "nearbyPet",
    title: "宠物社交",
    description: "多只宠物靠近时成对互动。",
    color: "lilac"
  },
  {
    id: "idleLife",
    title: "待机生活",
    description: "宠物闲着时自己随机播放。",
    color: "mint"
  },
  {
    id: "feeding",
    title: "喂食条件",
    description: "后续接入饥饿值和喂食系统。",
    color: "sun"
  },
  {
    id: "reserved",
    title: "备用动作",
    description: "保留给桌面端交互的素材位。",
    color: "muted"
  }
];

export const materialSlots: MaterialSlot[] = [
  { id: "idle_loop", name: "待机循环", trigger: "默认循环", cost: 18, durationSeconds: 10, group: "core", icon: "🐾", unlockTier: "basic" },
  { id: "sleep_loop", name: "睡觉", trigger: "长时间无操作", cost: 14, durationSeconds: 8, group: "core", icon: "💤", unlockTier: "basic" },
  { id: "catch_bug", name: "鼠标经过抓虫子", trigger: "鼠标经过宠物", cost: 12, durationSeconds: 5, group: "pointer", icon: "🪲", unlockTier: "basic" },
  { id: "catch_bug_up", name: "双手抓上方虫子", trigger: "鼠标经过宠物", cost: 12, durationSeconds: 5, group: "pointer", icon: "🙌", unlockTier: "advanced" },
  { id: "click_react", name: "点击反应", trigger: "点击宠物", cost: 12, durationSeconds: 4, group: "pointer", icon: "👆", unlockTier: "basic" },
  { id: "head_rub_left", name: "左边头蹭蹭", trigger: "另一只宠物靠近", cost: 12, durationSeconds: 5, group: "nearbyPet", icon: "🤍", unlockTier: "advanced" },
  { id: "head_rub_right", name: "右边头蹭蹭", trigger: "另一只宠物靠近", cost: 12, durationSeconds: 5, group: "nearbyPet", icon: "🤍", unlockTier: "advanced" },
  { id: "angry_swipe_left", name: "向左看生气挥一下爪子", trigger: "另一只宠物靠近", cost: 12, durationSeconds: 5, group: "nearbyPet", icon: "💢", unlockTier: "advanced" },
  { id: "angry_swipe_right", name: "向右看生气挥一下爪子", trigger: "另一只宠物靠近", cost: 12, durationSeconds: 5, group: "nearbyPet", icon: "💢", unlockTier: "advanced" },
  { id: "yawn", name: "打哈欠", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "🥱", unlockTier: "advanced" },
  { id: "lick_belly", name: "舔肚子的毛", trigger: "待机随机", cost: 10, durationSeconds: 8, group: "idleLife", icon: "🧼", unlockTier: "advanced" },
  { id: "lick_back", name: "舔背部的毛", trigger: "待机随机", cost: 10, durationSeconds: 8, group: "idleLife", icon: "🧽", unlockTier: "advanced" },
  { id: "stretch", name: "伸懒腰", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "〰️", unlockTier: "advanced" },
  { id: "happy", name: "开心", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "✨", unlockTier: "advanced" },
  { id: "disgusted", name: "嫌弃", trigger: "待机随机", cost: 10, durationSeconds: 5, group: "idleLife", icon: "😒", unlockTier: "advanced" },
  { id: "clingy", name: "粘人", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "🫶", unlockTier: "advanced" },
  { id: "aloof", name: "高冷", trigger: "待机随机", cost: 10, durationSeconds: 5, group: "idleLife", icon: "🧊", unlockTier: "advanced" },
  { id: "belly_up", name: "躺下翻肚皮", trigger: "待机随机", cost: 10, durationSeconds: 7, group: "idleLife", icon: "☁️", unlockTier: "advanced" },
  { id: "look_at_camera", name: "看镜头", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "👀", unlockTier: "advanced" },
  { id: "salary_cat_stinky_dance", name: "跳月薪喵散屁舞", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "🪩", unlockTier: "advanced" },
  { id: "head_bob_dance", name: "摇头晃脑舞", trigger: "待机随机", cost: 10, durationSeconds: 6, group: "idleLife", icon: "🎵", unlockTier: "advanced" },
  { id: "full_wash_face", name: "吃饱满足洗脸", trigger: "吃饱后触发", cost: 10, durationSeconds: 8, group: "feeding", icon: "🍚", unlockTier: "advanced" },
  { id: "hungry_meow", name: "饿了嗷嗷叫", trigger: "饥饿时触发", cost: 10, durationSeconds: 6, group: "feeding", icon: "📣", unlockTier: "advanced" }
];
