# CatDesktopPet

Native desktop pet MVP with a SwiftUI/AppKit macOS client, an Electron Windows client, and a Next.js web studio.

The repository now contains three product surfaces:

- `Sources/CatDesktopPet`: native macOS desktop pet app.
- `windows`: Electron + React + TypeScript Windows desktop pet app.
- `web`: Next.js web studio for accounts, credits, material generation, and cloud asset management.

The intended split is:

- Web handles registration, login, subscription, credits, image upload, image/video generation, and cloud material storage.
- Desktop Apps stay lightweight: local video import, desktop rendering, transparent windows, pet interaction, account sync, and friend/hosting controls.

## Run in Xcode

1. Open `Package.swift` in Xcode.
2. Select the `CatDesktopPet` scheme.
3. Choose `My Mac` as the run destination.
4. Press `Cmd + R`.
5. Use the menu bar paw icon to choose an MP4 or MOV green-screen cat video.

## Run Web Studio

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL` in `web/.env.local` to enable the Mac download button. The Windows button defaults to the latest `windows-test` GitHub Release ZIP and can be overridden with `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL`.

Current web MVP includes:

- Game-like material studio UI with selectable pets, portrait preview, material cards, jobs, friends, and billing mock panels.
- User login page at `/login` and admin login page at `/admin/login`, with Supabase Auth when configured and signed mock cookies for local preview.
- Pet material slot cards matching the Mac app slots.
- Interactive mock upload, credit deduction, generation polling, friend hosting, and pet recall flows.
- Desktop account sync bundle with account summary, pet numbers, owner/host fields, display state, and ready material URLs.
- Mock admin overview API for users, pets, materials, credits, recharge records, friendships, hosting requests, and editable grouped material configuration.
- Mock API routes under `web/src/app/api` with a typed client in `web/src/lib/api-client.ts`.
- Backend status detection for mock vs Supabase mode, plus a source-image upload route ready for Supabase Storage.
- Supabase adapter placeholder for the next backend step.

## Run Windows Client

```bash
cd windows
npm install
npm run dev
```

The Windows client starts from the system tray like the Mac menu bar app. Use the tray menu to choose local state videos, show or hide pets, toggle click-through, toggle mouseover catch, and reset positions. The compact studio window is optional and opens from `打开素材工作台`.

To sync against a local web studio instead of the deployed endpoint:

```bash
CAT_DESKTOP_PET_WEB_BASE_URL=http://localhost:3000 npm run dev
```

Useful checks:

```bash
npm test
npm run typecheck
npm run build
```

To create the Windows x64 ZIP used for download testing:

```bash
npm run dist:win
```

The package is written to `windows/release/CatDesktopPet-win-x64.zip`. If local cross-packaging is inconvenient, run the **Windows Desktop Artifact** GitHub Actions workflow. A manual workflow run also publishes the unsigned test ZIP to:

```text
https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip
```

Current Windows MVP includes:

- Tray menu labels, pet material slots, and per-pet submenu thumbnails aligned with the Mac app.
- Transparent always-on-top Electron pet windows with click, drag, click-through, saved position, size controls, sleep/wake recovery, mouseover catch, idle random actions, and nearby-pet paired interactions.
- Local MP4/MOV state-video import and per-pet video persistence.
- Canvas chroma-key rendering for green-screen pet videos.
- Compact account/studio UI for real account login, sync, synced pet cards, friends, hosting, recall, and sign-out.
- Desktop sync through `/api/desktop/auth/login`, `/api/desktop/pets`, `/api/friends`, and `/api/hosting/*`, including remote material download into a local `RemoteMaterials` cache.

Deployment notes live in `docs/deployment.md`, and the first Supabase schema draft lives in `docs/schema.sql`.

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
- Compact native account window for real account login, web sync, pet switching, friend hosting, and recall.
- Local state-video selection stays in the status bar menu for desktop playback testing.
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
- `DesktopAccountSessionStore`: local placeholder account session used before Supabase Auth is wired into the Mac app.
- `DesktopPetSyncClient`: account-aware desktop bundle fetch, ready video download, and local material registration.

## Notes

- Click-through mode lets mouse events pass to apps behind the pet window. Turn it off from the menu to click the pet again.
- The native window stays intentionally small. Registration, credits, subscriptions, image generation, and video generation belong to the web studio.
- The Mac app currently uses an account placeholder. Click `登录`, then `同步` to pull the desktop sync bundle. `退出` clears only the placeholder account and keeps local video references.
- The web studio is still mock-first when Supabase env vars are missing. Use `demo@desktop.pet / 123456` for the user workspace and `admin@desktop.pet / 123456` for the admin page. Real deployments should use Supabase Auth; admin access comes from Supabase `app_metadata.role = admin` or the server-only `ADMIN_EMAILS` allowlist.
- Front-image generation and state-video generation show progress and deduct local prototype credits, but do not call external APIs yet unless provider env vars are configured.
- Future web API wiring points:
  - `/api/upload-url`: create a signed upload URL in Supabase Storage.
  - `/api/source-images`: upload original pet images into Supabase Storage.
  - `/api/generation/front-image`: call GPT Image generation from the server.
  - `/api/generation/action-video`: call JiMeng video generation from the server.
  - `/api/jobs/[jobId]`: poll queued generation jobs.
  - `/api/pets/[petId]/materials`: register generated or uploaded videos for a pet.
  - `/api/hosting/*`: friend hosting request, accept/decline/return, and recall flows.
  - `/api/admin/overview`: admin data overview for future back-office pages.
- Future Mac sync points:
  - Download confirmed web-generated videos into local app storage.
  - Register downloaded videos with `SettingsStore.saveVideoURL(_:for:petIndex:)`.
  - Only display pets whose desktop bundle `displayState` is `active`; pets hosted away can stay in the account data without appearing locally.
  - Use desktop-side friend/hosting UI only for pet placement and sync, not payments or generation.
- Every cloud pet should have a stable UUID and a human-facing `pet_number` for support/admin lookup. Ownership is split into permanent owner and current host.
- The chroma key is intentionally simple for the MVP. Edge cleanup and feathering can be added later.
- `选择状态视频` contains separate upload slots for the current pet slots and is intentionally unchanged for testing.
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
- `Pets` can add, rename, or remove a selected pet slot. Removing a pet slot clears that pet's saved video references and name from the app, compacts later pet numbers, and does not delete the original video files from disk.
- Pet submenus show the custom name and a small thumbnail from that pet's `idle_loop` video when available.
- A pet only appears after its own `Idle Loop` video has been selected.
- `idle_loop` loops by default.
- Mouseover Catch randomly chooses from uploaded `catch_bug` and `catch_bug_up` videos when the cursor first passes over or very near the pet. It returns to `idle_loop` after playback.
- Nearby pet interaction checks visible pets every 6 seconds with an 18% chance per close pair. One pet starts the interaction by choosing the left or right interaction pool based on where the other pet is. Head-rub and angry-swipe videos have equal weight, with a 24-second cooldown per initiating pet.
- Nearby pet responses are paired by action type: left/right angry-swipe answers with the opposite-direction angry-swipe, and left/right head-rub answers with the opposite-direction head-rub. If the responding pet does not have that exact material, it does not respond.
- Click interaction randomly chooses from uploaded `click_react`, `happy`, `disgusted`, `clingy`, `aloof`, and `belly_up` videos.
- Idle random actions run every 12-28 seconds when available and the cursor is not near the pet. They randomly choose from uploaded yawn, licking, stretch, mood, hungry/full, personality, and belly-up videos.
- Mouse-drag movement only repositions the pet window; there is no separate drag action asset.
- `sleep_loop` plays once after 60 seconds of idle time when the cursor is not near the pet, then holds on the last frame until the pet wakes. Moving the cursor close to a sleeping pet wakes it back to `idle_loop`.
