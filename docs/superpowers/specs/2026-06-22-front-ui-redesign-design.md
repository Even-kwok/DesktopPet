# Front UI Redesign Design

## Context

The web frontend already contains the core product workflows: account login, pet selection, green-screen image upload, action video generation, job tracking, friend hosting, billing/credits, and desktop sync. The current page works, but the layout does not clearly prioritize the end-to-end user journey from "make materials" to "download a client" to "sync the pet to a device."

This redesign focuses on the signed-in frontend workspace and the signed-out home entry. It does not change backend behavior, API contracts, generation logic, admin pages, or the native macOS app.

## Goals

- Make the frontend feel like a clear generation workspace, not a loose collection of panels.
- Add a prominent client download area for Mac, Windows, iOS/iPadOS, and Android.
- Treat Mac as the priority desktop client entry. Enable the Mac download action only when a real package URL exists; otherwise show a clear "preparing" state. Windows and mobile clients should be visible "coming soon" entries.
- Keep the pet preview and upload flow visible without letting it dominate the whole page.
- Improve scanability of material generation cards, progress status, and navigation tabs.
- Preserve the existing warm pet-product tone while tightening spacing, hierarchy, and responsiveness.

## Design Direction

Use the "generation workspace" direction:

- A compact top bar keeps brand, account identity, credits, and logout visible.
- A new client center sits directly below the top bar. It is the most prominent cross-platform product area.
- The main workspace keeps the current left pet rail plus right content board pattern.
- The action materials tab becomes the primary page, with a workflow strip above the material sections.
- Secondary tabs remain available for pets, friends, jobs, and billing.

The client center should appear in two levels:

- Signed-out home: a simplified client preview and login/register entry, enough to communicate that generated pets sync to desktop and future platforms.
- Signed-in workspace: the full client center with a Mac client entry, Windows/mobile coming-soon entries, status text, and room for version/update copy.

## Signed-In Workspace Layout

The signed-in page should be organized top to bottom:

1. Top bar
   - Brand name.
   - Account identity and editable account name.
   - Credit balance.
   - Logout.

2. Client center
   - Mac client card marked as the priority desktop client.
   - Windows client card marked as coming soon.
   - iOS/iPadOS client card marked as coming soon.
   - Android client card marked as coming soon.
   - Copy should explain that the generated pet assets sync through the client.
   - The Mac action is enabled only when a real package URL is configured. Until then, it uses disabled/secondary copy such as "安装包准备中."

3. Workspace grid
   - Left pet panel:
     - Pet portrait/source image preview.
     - Current pet name and status.
     - Upload image call to action.
     - Pet selector and add-pet control.
     - Small stats such as ready materials and total basic progress.
   - Right main board:
     - Tab navigation.
     - Status message.
     - Active tab content.

4. Action materials tab
   - Workflow strip: upload image, complete basic actions, download/open client, sync to desktop.
   - Material sections grouped by existing unlock tiers: basic, advanced, custom.
   - Cards use stable dimensions, clearer status badges, short titles, preview area, progress if generating, and one clear action button.

## Signed-Out Home Layout

The signed-out page should stop feeling like a standalone marketing card and instead preview the product workflow:

- Header keeps login/register/admin entry.
- Main area shows a concise product promise and a simplified client/platform strip.
- Mac is shown as the priority desktop client; Windows and mobile are shown as coming soon.
- The login form remains immediately available on desktop and mobile.

## Components And Boundaries

Keep changes close to the existing frontend structure:

- `web/src/components/studio/studio-app.tsx`
  - Add small presentational components for the client center and workflow strip.
  - Reuse existing state and computed values where possible.
  - Keep generation, polling, upload, and sync behavior unchanged.

- `web/src/app/page.tsx`
  - Update signed-out home composition and copy.
  - Add the simplified platform/client preview.

- `web/src/app/globals.css`
  - Update layout, spacing, cards, responsive behavior, and visual hierarchy.
  - Keep the existing CSS-variable approach.

- `web/src/lib/studio-layout.ts`
  - Use helper functions only if display copy or derived UI state becomes meaningfully reusable or testable.

No new dependencies are required.

## States

Client cards:

- Priority desktop client: primary action enabled for Mac only if a package URL exists; otherwise show "安装包准备中" with a disabled or secondary action.
- Coming soon: visible card with disabled/secondary action.

Material cards:

- Missing: neutral preview and primary generate action.
- Queued/generating: progress visible, action disabled.
- Ready: video preview when available, ready badge, regenerate action.
- Failed: failure note visible; if an old video exists, show that the old material is preserved.

Responsive behavior:

- Client center stacks cleanly on narrow screens.
- Left pet rail becomes a normal top section on tablet/mobile.
- Material cards use responsive grid/flex constraints so long Chinese labels do not overflow buttons or cards.

## Testing And Verification

- Run TypeScript lint with `npm run lint` in `web`.
- Run unit tests with `npm run test:unit` in `web`.
- Start the Next.js dev server.
- Verify signed-out and signed-in frontend pages in a browser at desktop and mobile widths.
- Check for console errors, clipped button text, overlapping content, and broken responsive layout.

## Non-Goals

- Admin UI redesign.
- Native macOS UI redesign.
- Real package upload/storage implementation for Mac, Windows, iOS/iPadOS, or Android.
- Changing generation providers, prompts, costs, polling, authentication, or desktop sync API behavior.
