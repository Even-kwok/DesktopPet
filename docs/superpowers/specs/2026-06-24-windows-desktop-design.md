# Windows Desktop Client Design

## Context

The repository currently has two product surfaces:

- `Sources/CatDesktopPet`: a native macOS desktop pet app built with SwiftUI, AppKit, AVFoundation, and Core Image.
- `web`: a Next.js web studio for accounts, credits, material generation, cloud asset management, friends, hosting, and desktop sync APIs.

The Windows client should match the Mac client's desktop behavior while reusing the existing web sync contract. The selected implementation direction is Electron with React and TypeScript. This keeps Windows-specific system integration in Electron while letting the desktop studio and pet rendering use the same frontend language family as the web app.

## Goals

- Add a Windows desktop client that follows the Mac MVP feature set.
- Keep the Mac app intact and avoid changing existing Swift behavior while the Windows client is added.
- Reuse the existing `/api/desktop/auth/login`, `/api/desktop/pets`, `/api/friends`, and `/api/hosting/*` web contracts.
- Preserve local desktop testing with imported MP4/MOV videos.
- Display one or more transparent always-on-top desktop pets using local cached videos.
- Support green-screen removal in the Windows renderer so existing generated green-screen assets work.
- Keep desktop-side account UI lightweight: login, sync, pet list, friend hosting, recall, and local import controls.
- Make most non-platform logic testable with Node tests before relying on Electron integration checks.

## Approach Choice

Use a new `windows/` Electron application beside the existing Mac and web code.

Alternatives considered:

- .NET WPF or WinUI would give a more native Windows shell, but it would require rewriting UI and desktop sync logic in C# and duplicating more product code.
- Tauri would create a smaller package, but transparent multi-window video, click-through behavior, media handling, and packaging would add more platform debugging risk for this project.
- Electron is larger, but it is the fastest path to a feature-aligned Windows client with tray menus, transparent windows, React UI, Chromium video playback, and TypeScript tests.

## Product Scope

The Windows client should include these Mac-parity capabilities:

- System tray entry with:
  - 打开素材工作台
  - 选择状态视频
  - 删除状态视频
  - 宠物
  - 显示 / 隐藏宠物
  - 切换点击穿透
  - 切换鼠标经过抓虫
  - 重置位置
  - 退出
- Transparent borderless floating pet windows.
- Compact account/studio window for login, sync, pet switching, friend hosting, friend deletion, and recall.
- Local state-video selection for desktop playback testing.
- Per-pet local state-video storage.
- Initial pet window size of `150x150`, with scale choices from 100% down to 30%.
- Looping idle playback and one-shot reaction playback.
- Green-screen removal for generated videos.
- Click reaction, mouseover catch reaction, idle random actions, sleep/wake behavior, and nearby-pet paired interactions.
- Dragging a pet window to reposition it without changing the pet animation state.
- Hand cursor feedback while the pet accepts mouse input.
- Custom pet names for menu and window identification.
- Any number of pet slots, limited by Windows performance and video size.
- Per-pet saved position, size, visibility, click-through, mouseover-catch setting, video paths, and account session.
- Sleep/wake recovery for playback after Windows resumes.

The first Windows version should keep the desktop client focused. Registration, payments, credits, image generation, and video generation remain in the web studio.

## Architecture

Create `windows/` with an Electron application:

- Main process:
  - App lifecycle.
  - Tray menu and menu actions.
  - Pet window lifecycle.
  - Studio window lifecycle.
  - File pickers and local video inspection.
  - Window movement, sizing, visibility, click-through, always-on-top behavior.
  - Local JSON persistence in Electron's user data directory.
  - Remote material downloads into an application data cache.
  - System suspend/resume handling.

- Preload bridge:
  - Typed IPC surface exposed to React.
  - No direct Node access in renderer windows.
  - Safe wrappers for settings, pets, local imports, account sync, friends, hosting, and window commands.

- Renderer:
  - `pet` renderer for transparent pet windows.
  - `studio` renderer for the compact account/material window.
  - Shared React components and TypeScript domain models.
  - Canvas/WebGL chroma-key renderer around an HTML video element for green-screen removal.

- Shared domain modules:
  - Pet action slots and display labels.
  - Pet state machine.
  - Settings schema and migrations.
  - Desktop sync client types.
  - Video import review.
  - Proximity and idle interaction scheduling helpers.

## Proposed File Boundaries

The implementation should keep Windows code under `windows/`:

- `windows/package.json`: scripts and Electron/Vite/React dependencies.
- `windows/tsconfig.json`: strict TypeScript config for app and tests.
- `windows/src/shared/pet-action-slots.ts`: material slot ids, labels, trigger groups, and response-pair logic matching Mac.
- `windows/src/shared/pet-state-machine.ts`: hidden, idle, sleeping, clicked, catchingBug, idleAction, socialInteraction, grabbed, and dropped transitions.
- `windows/src/shared/settings-store.ts`: JSON-backed app settings, pet count, names, frames, size scale, video paths, and account session.
- `windows/src/shared/video-import-review.ts`: file-size, duration, and track checks with the same user-facing limits as Mac.
- `windows/src/shared/desktop-sync-client.ts`: login, bundle fetch, friends, hosting, recall, material download orchestration.
- `windows/src/main/app.ts`: Electron bootstrap and dependency wiring.
- `windows/src/main/tray-controller.ts`: tray menu construction and command dispatch.
- `windows/src/main/pet-colony-controller.ts`: multi-pet coordination and nearby-pet interactions.
- `windows/src/main/pet-window-controller.ts`: per-pet BrowserWindow lifecycle, frame persistence, click-through, and playback commands.
- `windows/src/main/studio-window-controller.ts`: studio BrowserWindow lifecycle.
- `windows/src/main/ipc.ts`: typed IPC handlers.
- `windows/src/preload/index.ts`: safe bridge exported to renderers.
- `windows/src/renderer/pet/PetWindow.tsx`: transparent pet renderer, mouse/drag events, video playback commands.
- `windows/src/renderer/pet/chroma-key.ts`: canvas/WebGL green-screen shader logic.
- `windows/src/renderer/studio/StudioApp.tsx`: compact account, pet sync, local import, friends, hosting, and recall UI.
- `windows/src/renderer/styles.css`: renderer styling.
- `windows/tests/*.test.ts`: Node tests for shared logic and Electron-independent controllers.

## Data Flow

Local import flow:

1. User selects a slot from the tray menu or studio window.
2. Main process opens a Windows file dialog for MP4/MOV files.
3. Main process inspects the selected file and rejects unsupported, oversized, too-long, or video-less files.
4. Settings store records the local path for the selected pet and slot.
5. If the slot is `idle_loop`, the pet becomes displayable and `showAll()` opens the pet window.
6. Other slots refresh active playback behavior without replacing the idle loop.

Desktop sync flow:

1. User logs in from the studio window.
2. The desktop sync client calls the existing web login endpoint and stores the account session locally.
3. Sync fetches the desktop pet bundle with a bearer token.
4. The client warns before replacing locally imported videos with cloud materials.
5. Ready materials are downloaded into `RemoteMaterials/<safe-pet-id>/`.
6. Settings records downloaded file paths by pet index and slot.
7. Only pets whose bundle state is displayable and whose materials include `idle_loop` are shown locally.
8. Synced pet cards stay cached after sign-out, while the account token is cleared.

Pet runtime flow:

1. Tray or startup restore calls `showAll()`.
2. Each displayable pet gets a transparent BrowserWindow.
3. The main process sends the selected video path and playback mode to the pet renderer.
4. The renderer plays the video, applies chroma key, and reports one-shot completion.
5. The state machine transitions back to idle after one-shot reactions.
6. Timers in the main process schedule sleep, idle actions, mouseover detection, and nearby-pet interactions.

## Windows Platform Behavior

Pet windows should use Electron `BrowserWindow` with:

- `transparent: true`
- `frame: false`
- `resizable: false` for normal runtime sizing
- `alwaysOnTop: true`
- `skipTaskbar: true`
- `hasShadow: false`

Click-through mode should call `setIgnoreMouseEvents(true, { forward: true })` when enabled. When disabled, the renderer handles click and drag events. Dragging moves the window by sending pointer deltas to the main process, which updates the BrowserWindow bounds and persists the frame.

The tray menu should be regenerated after settings, pet count, names, size scale, and video availability change. Menu labels should match the Mac app's Chinese labels.

Windows suspend/resume should pause active pet playback on suspend and rebuild or replay current videos after resume. Resume should delay briefly before restoring windows, matching the Mac recovery behavior.

## Video And Chroma Key

The pet renderer should use a hidden or offscreen `<video>` element as the media source and a visible canvas for output. Each animation frame:

1. Draws the current video frame to an offscreen canvas or WebGL texture.
2. Applies the same green-dominance chroma-key concept as the Mac `ChromaKeyRenderer`.
3. Despills green edges.
4. Draws the transparent result into the visible canvas with aspect-fit sizing.

The first implementation can use a 2D canvas pixel pipeline if it is simpler to test, then move to WebGL if performance is not acceptable with multiple pets. The renderer must keep transparent background outside the pet pixels.

## Studio UI

The Windows studio should mirror the current Mac compact studio rather than the full web generation workspace:

- Signed-out state:
  - Email and password fields.
  - Login button.
  - Short note that generation lives on the web studio.

- Signed-in state:
  - Account summary and credits.
  - Sync button.
  - Sign-out button.
  - Synced pet cards with pet number, status, material count, select, and recall actions.
  - Friend list with refresh, add by email, delete, and host selected pet.

- Local material area:
  - Pet selector, add pet, rename pet.
  - Material slots grouped by the existing material groups.
  - Per-slot import/remove controls and status text.

The UI should be utilitarian and compact, with no marketing landing page in the desktop client.

## Error Handling

- Login failures should show "登录失败，请检查账号和密码。"
- Expired sessions should show "登录已过期，请重新登录。"
- Empty bundles should show "网页端还没有可同步的视频素材。"
- Bundles without displayable idle-loop materials should show "请先在网页端生成「待机循环」素材，再同步到桌面 App。"
- Video import should block files without video tracks, files longer than 60 seconds, files larger than 300 MB, and unreadable files.
- Video import should warn for clips over 15 seconds or over 80 MB.
- Remote material download failures should keep existing local paths unchanged for the affected slot.

## Testing And Verification

Automated tests:

- Shared pet action slots match Mac slot ids, display names, trigger groups, and response pairs.
- State machine transitions match Mac behavior.
- Settings store defaults, pet deletion compaction, pet size clamping, video path persistence, and account-session persistence work.
- Video import review accepts normal clips, blocks invalid clips, and warns for long or large clips.
- Desktop sync client decodes bundles, filters displayable pets, sends bearer tokens, maps 401 to session-expired, and detects local material replacement.
- Synced pet cards remain cached after sign-out.

Manual/Electron verification on Windows:

- `npm run test` in `windows` passes.
- `npm run typecheck` in `windows` passes.
- `npm run dev` starts the Electron client.
- Tray menu appears and all menu actions are reachable.
- Selecting an `idle_loop` video opens a transparent always-on-top pet window.
- Green background is removed from a generated green-screen video.
- Clicking, dragging, click-through, mouseover catch, idle random action, sleep/wake, and reset position behave like the Mac app.
- Multiple pets can be shown, moved, resized, and triggered independently.
- Login, sync, friend refresh, add/delete friend, hosting request, and recall call the existing web APIs.
- App restart restores visibility, pet positions, sizes, names, click-through state, mouseover setting, local videos, and synced account cache.

## Non-Goals

- Rewriting the Mac app.
- Replacing the web studio generation workflow.
- Implementing Windows payments, registration, or admin management in the desktop client.
- Building mobile clients.
- Changing the existing web API contract unless a Windows integration test exposes a real compatibility bug.
- Adding auto-update or installer publishing in the first Windows feature plan.
