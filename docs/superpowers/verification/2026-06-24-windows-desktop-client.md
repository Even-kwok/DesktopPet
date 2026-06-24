# Windows Desktop Client Verification

## Automated Evidence

Run from `windows/` on the current branch:

- `npm run typecheck`: passed.
- `npm test`: passed, 238 tests.
- `npm run build`: passed.
- `git diff --check`: passed.

Run from `web/` on the current branch:

- `npm run lint`: passed.
- `npm run test:unit`: passed, 103 tests.
- `npm run build`: passed.

Additional automated coverage now includes the shared Electron `BrowserWindow` option builders for the Windows pet and Studio windows. These tests assert transparent always-on-top pet windows use an explicit transparent background, stay non-focusable like the Mac nonactivating panel, and that both renderer surfaces use a sandboxed preload bridge with Node integration disabled.

The Windows tray menu now also has automated coverage for Mac-parity pet submenu thumbnails. A cached thumbnail provider requests 28x28 native thumbnails from each pet's `idle_loop` video, refreshes the tray when an icon becomes available, and falls back to a paw-style placeholder icon when no video is available or thumbnail generation fails.

Tray menu robustness coverage now verifies malformed pet counts are normalized before building Windows tray submenus, avoiding `NaN`/infinite pet labels or unsafe submenu lengths.

Material-slot coverage now verifies Windows exposes the same trigger descriptions as the Mac Studio cards, including `默认循环`, `点击宠物`, `鼠标经过宠物`, `另一只宠物靠近`, and `待机随机`.

Material-group coverage now verifies Windows exposes the same Mac Studio group titles and helper descriptions, such as `基础状态` with `宠物显示、睡觉等基础素材。`, and shows group-level completion counts in the Studio.

Studio material-board coverage now verifies Windows uses the Mac `动作卡册` title and the same helper copy that material actions appear in their corresponding scenes, including the preview prompt.

System wake coverage now includes the pet-window resume policy: hidden pet windows stay hidden, while visible pet windows are restored and replay the current state without issuing a second state-machine `show` event.

Timed pet-action coverage now verifies Windows rechecks sleep and idle-random video availability when the timer fires, matching the Mac guard when a material is removed after scheduling.

Pet-window playback refresh coverage now verifies hidden Windows pet windows ignore direct refresh requests, matching the Mac single-window guard in addition to the colony-level visible-window filter.

Startup restoration coverage now verifies that a previously hidden session does not show pets, a visible session stays visible when at least one `idle_loop` can be restored, and saved visibility is turned off when no pet can be restored.

Startup restoration coverage now also verifies Windows applies the saved click-through setting before restoring pet visibility, matching the Mac restart path.

Remote material import coverage now directly verifies that an existing local material path is left untouched if the corresponding cloud material download fails.

Local import planning coverage now verifies that invalid Windows IPC pet indexes do not turn an `idle_loop` import request into a `NaN` pet count or collapse the saved pet list.

Local import visibility coverage now verifies that an `idle_loop` import only saves the Windows pets as visible when the import actually results in at least one displayable pet window.

Tray add-pet import coverage now verifies that the follow-up `idle_loop` import target falls back to the first pet when an invalid add result is encountered.

Local import target coverage now verifies renderer-supplied pet indexes are normalized before the Windows app builds picker copy, grows pet count, saves the selected video, and refreshes playback.

Local video metadata coverage now verifies Windows drive-letter paths and UNC network share paths are normalized into safe `file://` probe URLs before the hidden Electron metadata reader inspects imported videos.

Settings-store coverage now also verifies that inactive boundary pet slots cannot retain ghost size or frame data before a pet actually exists.

Settings-store video-path coverage now verifies blank local material paths are ignored and cannot overwrite an existing restorable Windows video reference.

Settings-store display coverage now verifies invalid JavaScript pet indexes fall back to the first pet name and default frame instead of leaking `Pet NaN` or invalid coordinates into Windows UI surfaces.

Settings-store frame coverage now verifies malformed frame writes cannot overwrite a valid saved Windows pet position before restart restore.

Settings-store studio-cache coverage now verifies negative synced-pet material counts and friend hosted-pet counts are treated as malformed instead of being shown in the Windows Studio.

Settings-store studio-cache coverage now verifies cached synced-pet and friend cards with empty identity fields are ignored on restart instead of rendering blank Windows Studio entries.

Settings-store synced-card coverage now verifies successful recall marks a pet as owned/active, while Studio hosting-request coverage verifies pending hosting requests keep synced pet cards unchanged until a later sync reports a hosted/away state.

Settings-store account-session coverage now verifies cached account sessions with empty access tokens or blank identity/sign-in fields are ignored on restart instead of showing the Windows Studio as signed in with an unusable account.

Studio account-display coverage now verifies Windows uses the same `未登录` fallback, account name, and `邮箱 · N 积分` detail copy as the Mac account panel.

Desktop sync coverage now verifies remote friend-list responses with negative hosted-pet counts are rejected before they can enter the Windows Studio.

Desktop sync identity coverage now verifies remote pet bundle and friend-list responses with empty pet `id`/`name`/`type` fields or friend `id`/`name` fields are rejected before they can enter the Windows Studio or sync cache.

Desktop sync display-field coverage now verifies remote material names/statuses and friend statuses must be non-empty before the Windows Studio uses them for replacement warnings, import decisions, or friend rows.

Desktop sync card coverage now verifies empty optional pet-number, ownership, and display-state fields fall back to stable Studio defaults instead of rendering blank card metadata or disabling normal host actions.

Desktop sync action-response coverage now verifies empty remove-friend, hosting-request, and recall response identifiers/status fields are rejected before the Windows Studio treats those remote actions as successful.

Desktop sync account coverage now verifies login and bundle account records with negative credit balances or empty identity/email fields are rejected before they can be shown in the Windows Studio.

Desktop sync session coverage now verifies login responses with negative token expiry values are rejected before the Windows client caches a bearer session.

Desktop sync bearer-session coverage now verifies login responses with empty modes, empty access tokens, or unsupported token types are rejected before the Windows client stores an unusable session.

Desktop sync bundle metadata coverage now verifies negative bundle versions, negative recommended polling intervals, empty bundle timestamps, and empty sync mode/source values are rejected before they can influence Windows sync behavior.

Colony-controller coverage now verifies invalid JavaScript pet-count values are ignored instead of collapsing active Windows pets or entering unsafe controller creation paths.

Studio selection coverage now verifies invalid renderer pet indexes and malformed pet counts fall back to the first pet instead of leaking `NaN` into the selected pet or name draft.

Studio status coverage now verifies pets marked as `away` show the same friend-hosted status that drives the recall action, even if a refreshed card still reports an active display state.

Studio login-panel coverage now verifies Windows uses the Mac `登录后同步你的猫咪` title and the same feature-boundary helper copy with the Windows platform name.

Studio login-action coverage now verifies Windows follows the Mac login gate: empty credentials show the same validation copy, while only in-flight login submissions disable the login button.

Studio friend-row coverage now verifies Windows uses the same `状态 · 托管 N 只` detail copy as the Mac Studio for hosted-pet counts.

Studio friend-panel coverage now verifies Windows uses the Mac `好友` title, `N 位 · 可寄养和删除` summary, and the same empty-state guidance copy.

Studio friend-add coverage now verifies Windows uses the Mac friend-email placeholder, supports Enter-to-add, shows the same `请先登录账号。` / `请输入好友邮箱。` validation copy, and disables add submissions while a friend mutation is already in progress.

Studio friend-action coverage now verifies Windows follows the Mac pending-state gates for friend refreshes and friend mutations, so refresh, delete, hosting request, and recall controls are disabled while their corresponding account action is already in progress.

Studio synced-pet-panel coverage now verifies Windows uses the Mac `我的猫咪` title, `N 只` summary, and the same empty sync-state guidance copy.

Studio synced-pet-card coverage now verifies Windows uses the Mac per-card action rules: unselected cards show `选择`, selected recallable cards show `召回`, and selected active cards show no action.

Studio local-material coverage now verifies Windows uses the Mac material status copy for local videos: `已有视频` when a slot has a video and `未生成` when it does not.

Studio local-material preview coverage now verifies Windows exposes restorable local video paths for Studio previews, uses the same enabled/disabled preview action states as the Mac material cards, and shows the Mac `点预览播放` / `等待素材` hints.

Studio renderer-list coverage now verifies malformed pet counts display as safe non-negative counts and keep a bounded placeholder pet selector instead of rendering invalid list lengths.

Studio sync-action coverage now verifies Windows follows the Mac sync gate: syncing is disabled while signed out or while a desktop bundle sync is already in progress.

Studio sync-result coverage now verifies malformed summary counts fall back to the generic success copy instead of showing `NaN`, infinite, or negative counts in the Windows UI.

Studio action-runner coverage now verifies failed actions still refresh the latest Studio state before showing the error message, so Mac-parity partial sync side effects such as cached pet cards remain visible after import-stage failures.

Studio refresh coverage now verifies tray-side and other main-process state changes send a refresh command to an already-open Studio window without opening hidden/unloaded Studio windows.

Renderer command coverage now verifies Windows only sends Studio and pet playback commands to live Electron web contents, avoiding stale sends after windows are closed or destroyed.

Studio show-command coverage now verifies async Studio show completions skip refresh/select commands when the renderer command target has already gone away.

Pet show-command coverage now verifies async pet renderer load completions stop before touching a destroyed BrowserWindow/webContents target, matching the stale-renderer guard used by Studio commands.

Renderer load coverage now verifies failed Electron renderer loads settle without running show completion or producing an unhandled rejection, Electron error pages are treated as unloaded so later show attempts can retry, and successful loads still finish the Studio or pet show path.

Web studio publish-status coverage now verifies desktop sync success and failure copy refers to the shared desktop clients instead of only the Mac client, so generated materials point users toward both Mac and Windows desktop sync.

Web studio recall-status coverage now verifies successful recall copy points to the shared desktop App sync path instead of only the Mac App, so Windows users get accurate post-recall guidance.

## Electron Smoke Evidence

Run from `windows/`:

- `npm run dev`: main process and preload builds passed, renderer dev server started at `http://localhost:5173/`, and Electron app startup was reached after the preload runtime path was corrected to `out/preload/index.mjs`.

The smoke run was stopped after startup to avoid leaving a desktop process running.

## Remaining Manual Windows Verification

These items still require a real Windows desktop session:

- Tray icon appears in the Windows notification area and all menu actions are reachable.
- Importing an `idle_loop` MP4/MOV opens a transparent always-on-top pet window.
- Imported video metadata is read correctly for Windows file paths, including long/invalid/video-less clips.
- Click, drag, click-through, mouseover catch, idle random actions, sleep/wake, reset position, and nearby-pet paired interactions behave like the Mac app.
- Multiple pets can be shown, moved, resized, and triggered independently on Windows displays.
- Login, sync, friend refresh, add/delete friend, hosting request, and recall call the existing web APIs from a Windows build.
- App restart restores visibility, pet positions, sizes, names, click-through state, mouseover setting, local videos, selected synced pet, and account/synced cache.
