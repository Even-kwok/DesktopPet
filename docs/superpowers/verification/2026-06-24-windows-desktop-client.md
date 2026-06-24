# Windows Desktop Client Verification

## Automated Evidence

Run from `windows/` on the current branch:

- `npm run typecheck`: passed.
- `npm test`: passed, 184 tests.
- `npm run build`: passed.
- `git diff --check`: passed.

Additional automated coverage now includes the shared Electron `BrowserWindow` option builders for the Windows pet and Studio windows. These tests assert transparent always-on-top pet windows use an explicit transparent background, and that both renderer surfaces use a sandboxed preload bridge with Node integration disabled.

The Windows tray menu now also has automated coverage for Mac-parity pet submenu thumbnails. A cached thumbnail provider requests 28x28 native thumbnails from each pet's `idle_loop` video, refreshes the tray when an icon becomes available, and falls back to a paw-style placeholder icon when no video is available or thumbnail generation fails.

System wake coverage now includes the pet-window resume policy: hidden pet windows stay hidden, while visible pet windows are restored and replay the current state without issuing a second state-machine `show` event.

Startup restoration coverage now verifies that a previously hidden session does not show pets, a visible session stays visible when at least one `idle_loop` can be restored, and saved visibility is turned off when no pet can be restored.

Remote material import coverage now directly verifies that an existing local material path is left untouched if the corresponding cloud material download fails.

Local import planning coverage now verifies that invalid Windows IPC pet indexes do not turn an `idle_loop` import request into a `NaN` pet count or collapse the saved pet list.

Tray add-pet import coverage now verifies that the follow-up `idle_loop` import target falls back to the first pet when an invalid add result is encountered.

Settings-store coverage now also verifies that inactive boundary pet slots cannot retain ghost size or frame data before a pet actually exists.

Settings-store display coverage now verifies invalid JavaScript pet indexes fall back to the first pet name and default frame instead of leaking `Pet NaN` or invalid coordinates into Windows UI surfaces.

Settings-store studio-cache coverage now verifies negative synced-pet material counts and friend hosted-pet counts are treated as malformed instead of being shown in the Windows Studio.

Desktop sync coverage now verifies remote friend-list responses with negative hosted-pet counts are rejected before they can enter the Windows Studio.

Desktop sync account coverage now verifies login and bundle account records with negative credit balances are rejected before they can be shown in the Windows Studio.

Desktop sync session coverage now verifies login responses with negative token expiry values are rejected before the Windows client caches a bearer session.

Desktop sync bearer-session coverage now verifies login responses with empty access tokens or unsupported token types are rejected before the Windows client stores an unusable session.

Desktop sync bundle metadata coverage now verifies negative bundle versions and negative recommended polling intervals are rejected before they can influence Windows sync behavior.

Colony-controller coverage now verifies invalid JavaScript pet-count values are ignored instead of collapsing active Windows pets or entering unsafe controller creation paths.

Studio selection coverage now verifies invalid renderer pet indexes and malformed pet counts fall back to the first pet instead of leaking `NaN` into the selected pet or name draft.

Studio renderer-list coverage now verifies malformed pet counts display as safe non-negative counts and keep a bounded placeholder pet selector instead of rendering invalid list lengths.

Studio sync-result coverage now verifies malformed summary counts fall back to the generic success copy instead of showing `NaN`, infinite, or negative counts in the Windows UI.

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
