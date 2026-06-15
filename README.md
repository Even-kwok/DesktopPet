# CatDesktopPet

Native macOS desktop pet MVP built with SwiftUI, AppKit, AVFoundation, and Core Image.

## Run in Xcode

1. Open `Package.swift` in Xcode.
2. Select the `CatDesktopPet` scheme.
3. Choose `My Mac` as the run destination.
4. Press `Cmd + R`.
5. Use the menu bar paw icon to choose an MP4 or MOV green-screen cat video.

## MVP Scope

- Menu bar entry with:
  - 打开素材工作台
  - 选择状态视频
  - 删除状态视频
  - 宠物
  - 显示 / 隐藏宠物
  - 切换点击穿透
  - 切换鼠标经过抓虫
  - 重置位置
  - 退出
- Transparent borderless floating cat panel.
- Native material studio window for image upload, front-image confirmation, and state-video generation placeholders.
- Fixed initial panel size: `150x150`.
- Looping video playback.
- Simple green-screen removal using a Core Image color cube threshold.
- Click interaction support.
- Drag the pet window to reposition it without changing the pet's animation state.
- Optional mouseover catch interaction driven by the `catch_bug` video.
- Hand cursor feedback over the pet, with click interaction driven by the optional `click_react` video.
- Custom pet names for menu identification.
- Pet menu thumbnails generated from each pet's own `idle_loop` video.
- Initial state machine covering `hidden`, `idle`, `sleeping`, `clicked`, `catchingBug`, `idleAction`, `socialInteraction`, `grabbed`, and `dropped`.
- Any number of pet slots can be added from the menu. Practical limits depend on video size and Mac performance.
- Each pet window saves its own position.
- Restart persistence for video path/bookmark, panel frame, visibility, and click-through state.

## Code Structure

- `AppDelegate`: App bootstrap.
- `StatusBarController`: Menu bar item, menu actions, video picker.
- `PetWindowController`: Transparent floating panel lifecycle.
- `PetView`: Mouse interactions and cursor feedback.
- `VideoPlayerView`: AVFoundation playback and frame rendering.
- `ChromaKeyRenderer`: Core Image green-screen removal.
- `PetStateMachine`: MVP state transitions.
- `SettingsStore`: UserDefaults persistence and video bookmarks.

## Notes

- Click-through mode lets mouse events pass to apps behind the pet window. Turn it off from the menu to click the pet again.
- The material studio is currently a UI mock for the upcoming API flow. Front-image generation and state-video generation show progress and deduct local prototype credits, but do not call external APIs yet.
- Future API wiring points:
  - Image upload + GPT Image generation belongs behind `PetStudioViewModel.generateFrontImage()`.
  - State video generation belongs behind `PetStudioViewModel.generate(slot:)`.
  - API-returned videos should be saved locally, then registered with `SettingsStore.saveVideoURL(_:for:petIndex:)`.
- The chroma key is intentionally simple for the MVP. Edge cleanup and feathering can be added later.
- `选择状态视频` contains separate upload slots for the current pet slots.
- `删除状态视频` clears a selected slot from the app without deleting the original video file.
- Each pet has its own state videos. Menu labels are Chinese, and the internal keys are:
  - `idle_loop`: 待机循环
  - `sleep_loop`: 睡觉
  - `click_react`: 点击反应
  - `catch_bug`: 鼠标经过抓虫子
  - `catch_bug_up`: 双手抓上方虫子
  - `head_rub_left`: 左边头蹭蹭
  - `head_rub_right`: 右边头蹭蹭
  - `angry_swipe_left`: 向左看生气挥一下爪子
  - `angry_swipe_right`: 向右看生气挥一下爪子
  - `yawn`: 打哈欠
  - `lick_belly`: 舔肚子的毛
  - `lick_back`: 舔背部的毛
  - `stretch`: 伸懒腰
  - `happy`: 开心
  - `disgusted`: 嫌弃
  - `full_wash_face`: 吃饱满足洗脸
  - `hungry_meow`: 饿了嗷嗷叫
  - `clingy`: 粘人
  - `aloof`: 高冷
  - `belly_up`: 躺下翻肚皮
  - `drag_loop`: 拖拽循环（备用）
- `Pets` can add, rename, or remove a selected pet slot. Removing a pet slot clears that pet's saved video references and name from the app, compacts later pet numbers, and does not delete the original video files from disk.
- Pet submenus show the custom name and a small thumbnail from that pet's `idle_loop` video when available.
- A pet only appears after its own `Idle Loop` video has been selected.
- `idle_loop` loops by default.
- Mouseover Catch randomly chooses from uploaded `catch_bug` and `catch_bug_up` videos when the cursor first passes over or very near the pet. It returns to `idle_loop` after playback.
- Nearby pet interaction checks visible pets every 6 seconds with an 18% chance per close pair. One pet starts the interaction by choosing the left or right interaction pool based on where the other pet is. Head-rub and angry-swipe videos have equal weight, with a 24-second cooldown per initiating pet.
- Nearby pet responses are paired by action type: left/right angry-swipe answers with the opposite-direction angry-swipe, and left/right head-rub answers with the opposite-direction head-rub. If the responding pet does not have that exact material, it does not respond.
- Click interaction randomly chooses from uploaded `click_react`, `happy`, `disgusted`, `clingy`, `aloof`, and `belly_up` videos.
- Idle random actions run every 12-28 seconds when available and the cursor is not near the pet. They randomly choose from uploaded yawn, licking, stretch, mood, hungry/full, personality, and belly-up videos.
- `drag_loop` is kept as an action asset slot for future interactions. Mouse-drag movement only repositions the pet window and does not switch to a grabbed animation.
- `sleep_loop` plays once after 60 seconds of idle time when the cursor is not near the pet, then holds on the last frame until the pet wakes. Moving the cursor close to a sleeping pet wakes it back to `idle_loop`.
