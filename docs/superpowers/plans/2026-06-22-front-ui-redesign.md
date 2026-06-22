# Front UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the web frontend into a clearer generation workspace with a prominent client download center for Mac, Windows, iOS/iPadOS, and Android.

**Architecture:** Keep behavior in the existing React/Next.js files and add small pure display helpers in `studio-layout.ts` so platform state and workflow text are testable. The signed-in workspace gets a full client center above the pet/material workspace; the signed-out home gets a simplified product/client preview without changing auth behavior. CSS remains centralized in `globals.css` and uses the existing design-token pattern.

**Tech Stack:** Next.js App Router, React client components, TypeScript, CSS modules via global stylesheet, Node test runner.

---

### Task 1: Add Testable Display Models

**Files:**
- Modify: `web/src/lib/studio-layout.test.ts`
- Modify: `web/src/lib/studio-layout.ts`

- [ ] **Step 1: Write failing tests for client cards and workflow steps**

Add imports in `web/src/lib/studio-layout.test.ts`:

```ts
import {
  buildClientPlatformCards,
  buildMaterialWorkflowSteps
} from "./studio-layout.ts";
```

Add tests:

```ts
test("client platform cards expose Mac priority and future platform states", () => {
  assert.deepEqual(buildClientPlatformCards(null), [
    {
      id: "mac",
      title: "Mac 端",
      description: "桌面宠物主客户端，同步账号内已生成动作。",
      statusLabel: "优先入口",
      actionLabel: "安装包准备中",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "windows",
      title: "Windows 端",
      description: "未来支持 Windows 桌面宠物展示与同步。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "ios",
      title: "iOS / iPadOS",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "android",
      title: "Android",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    }
  ]);

  const [mac] = buildClientPlatformCards("https://example.com/CatDesktopPet.dmg");

  assert.deepEqual(mac, {
    id: "mac",
    title: "Mac 端",
    description: "桌面宠物主客户端，同步账号内已生成动作。",
    statusLabel: "可下载",
    actionLabel: "下载 Mac 版",
    actionUrl: "https://example.com/CatDesktopPet.dmg",
    isEnabled: true
  });
});

test("material workflow steps describe the current generation path", () => {
  assert.deepEqual(
    buildMaterialWorkflowSteps({
      hasFrameImage: false,
      basicReadyCount: 0,
      basicTotalCount: 4,
      totalReadyCount: 0,
      hasMacDownload: false
    }),
    [
      { title: "上传绿幕图", state: "待上传" },
      { title: "补齐基础版", state: "0/4" },
      { title: "准备客户端", state: "安装包准备中" },
      { title: "同步到桌面", state: "待动作" }
    ]
  );

  assert.deepEqual(
    buildMaterialWorkflowSteps({
      hasFrameImage: true,
      basicReadyCount: 4,
      basicTotalCount: 4,
      totalReadyCount: 6,
      hasMacDownload: true
    }),
    [
      { title: "上传绿幕图", state: "已就位" },
      { title: "补齐基础版", state: "4/4" },
      { title: "准备客户端", state: "Mac 可下载" },
      { title: "同步到桌面", state: "可同步" }
    ]
  );
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
cd web
node --experimental-strip-types --test src/lib/studio-layout.test.ts
```

Expected: fail because `buildClientPlatformCards` and `buildMaterialWorkflowSteps` do not exist.

- [ ] **Step 3: Implement the display helpers**

Add to `web/src/lib/studio-layout.ts`:

```ts
export type ClientPlatformId = "mac" | "windows" | "ios" | "android";

export type ClientPlatformCard = {
  id: ClientPlatformId;
  title: string;
  description: string;
  statusLabel: string;
  actionLabel: string;
  actionUrl: string | null;
  isEnabled: boolean;
};

export function buildClientPlatformCards(macDownloadUrl: string | null): ClientPlatformCard[] {
  const normalizedMacUrl = macDownloadUrl?.trim() || null;

  return [
    {
      id: "mac",
      title: "Mac 端",
      description: "桌面宠物主客户端，同步账号内已生成动作。",
      statusLabel: normalizedMacUrl ? "可下载" : "优先入口",
      actionLabel: normalizedMacUrl ? "下载 Mac 版" : "安装包准备中",
      actionUrl: normalizedMacUrl,
      isEnabled: Boolean(normalizedMacUrl)
    },
    {
      id: "windows",
      title: "Windows 端",
      description: "未来支持 Windows 桌面宠物展示与同步。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "ios",
      title: "iOS / iPadOS",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    },
    {
      id: "android",
      title: "Android",
      description: "未来支持移动端账号管理与轻量预览。",
      statusLabel: "即将开放",
      actionLabel: "即将开放",
      actionUrl: null,
      isEnabled: false
    }
  ];
}

export type MaterialWorkflowStep = {
  title: string;
  state: string;
};

export function buildMaterialWorkflowSteps(input: {
  hasFrameImage: boolean;
  basicReadyCount: number;
  basicTotalCount: number;
  totalReadyCount: number;
  hasMacDownload: boolean;
}): MaterialWorkflowStep[] {
  return [
    {
      title: "上传绿幕图",
      state: input.hasFrameImage ? "已就位" : "待上传"
    },
    {
      title: "补齐基础版",
      state: `${input.basicReadyCount}/${input.basicTotalCount}`
    },
    {
      title: "准备客户端",
      state: input.hasMacDownload ? "Mac 可下载" : "安装包准备中"
    },
    {
      title: "同步到桌面",
      state: input.totalReadyCount > 0 ? "可同步" : "待动作"
    }
  ];
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run:

```bash
cd web
node --experimental-strip-types --test src/lib/studio-layout.test.ts
```

Expected: all `studio-layout` tests pass.

### Task 2: Add Client Center And Workflow To The Signed-In Studio

**Files:**
- Modify: `web/src/components/studio/studio-app.tsx`

- [ ] **Step 1: Import display helpers**

Update the `studio-layout` import in `web/src/components/studio/studio-app.tsx`:

```ts
import {
  accountNameEditControlCopy,
  assetStatusAfterGenerationFailure,
  buildClientPlatformCards,
  buildMaterialWorkflowSteps,
  jobDisplayName,
  jobGeneratedAtLabel,
  jobGeneratedVideoApplyAction,
  materialCardPreviewState,
  petNameEditControlCopy,
  petPanelImageUrl,
  petPanelStats,
  studioStatusMessageClassName
} from "@/lib/studio-layout";
```

- [ ] **Step 2: Add the Mac package URL and client card data**

Inside `StudioApp`, derive:

```ts
const macDownloadUrl = process.env.NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL?.trim() || null;
const clientCards = buildClientPlatformCards(macDownloadUrl);
```

- [ ] **Step 3: Render `ClientCenter` directly below the top bar**

In the `StudioApp` JSX, place:

```tsx
<ClientCenter cards={clientCards} />
```

between the top bar and the status message.

- [ ] **Step 4: Replace `StarterSteps` internals with `buildMaterialWorkflowSteps`**

In `StarterSteps`, derive steps with:

```ts
const steps = buildMaterialWorkflowSteps({
  basicReadyCount,
  basicTotalCount,
  hasFrameImage,
  hasMacDownload: Boolean(process.env.NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL?.trim()),
  totalReadyCount
});
```

- [ ] **Step 5: Add presentational components**

Add `ClientCenter` and `ClientAction` below `PetPanel`:

```tsx
function ClientCenter({ cards }: { cards: ReturnType<typeof buildClientPlatformCards> }) {
  return (
    <section className="panel client-center" aria-label="客户端下载中心">
      <div className="client-center-copy">
        <span className="eyebrow">客户端中心</span>
        <h2>把生成好的宠物同步到你的设备</h2>
        <p>先生成基础动作，再下载安装客户端。Mac 端优先准备，Windows 和手机端入口先预留。</p>
      </div>
      <div className="client-platform-grid">
        {cards.map((card) => (
          <article className={card.isEnabled ? "client-platform-card enabled" : "client-platform-card"} key={card.id}>
            <span className={card.isEnabled ? "badge success" : "badge muted"}>{card.statusLabel}</span>
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
            <ClientAction card={card} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientAction({ card }: { card: ReturnType<typeof buildClientPlatformCards>[number] }) {
  if (card.isEnabled && card.actionUrl) {
    return (
      <a className="button client-action" href={card.actionUrl}>
        {card.actionLabel}
      </a>
    );
  }

  return (
    <button className="button secondary client-action" disabled type="button">
      {card.actionLabel}
    </button>
  );
}
```

- [ ] **Step 6: Run TypeScript**

Run:

```bash
cd web
npm run lint
```

Expected: type check passes.

### Task 3: Update The Signed-Out Home

**Files:**
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Import and build platform cards**

Add:

```ts
import { buildClientPlatformCards } from "@/lib/studio-layout";
```

Inside `SignedOutHome`:

```ts
const clientCards = buildClientPlatformCards(
  process.env.NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL?.trim() || null
);
```

- [ ] **Step 2: Replace the signed-out board content**

Update the board so it contains:

```tsx
<section className="panel signed-out-board">
  <div className="signed-out-copy">
    <span className="eyebrow">DesktopPet Studio</span>
    <h2>生成动作素材，再把宠物同步到桌面</h2>
    <p>上传绿幕猫咪图，补齐基础动作，之后通过客户端把会动的小家伙放到你的设备上。</p>
  </div>
  <div className="signed-out-client-preview" aria-label="客户端入口预览">
    {clientCards.map((card) => (
      <div className={card.isEnabled ? "signed-out-client-card enabled" : "signed-out-client-card"} key={card.id}>
        <strong>{card.title}</strong>
        <span>{card.statusLabel}</span>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 3: Preserve existing auth form behavior**

Keep the current login/register/admin form and hidden `next` input unchanged.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
cd web
npm run lint
```

Expected: type check passes.

### Task 4: Redesign Global Frontend Styling

**Files:**
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Add client-center styles**

Add styles for:

```css
.eyebrow
.client-center
.client-center-copy
.client-platform-grid
.client-platform-card
.client-platform-card.enabled
.client-action
```

These styles must make the client center prominent, responsive, and visually connected to the existing warm pet-product palette.

- [ ] **Step 2: Tighten workspace styles**

Adjust existing styles for:

```css
.layout-grid
.pet-card
.pet-stage
.main-board
.tabs
.starter-strip
.starter-steps
.materials-grid
.material-card
```

The result should keep the left pet rail and right material board, but reduce visual looseness and make card grids easier to scan.

- [ ] **Step 3: Update signed-out styles**

Adjust:

```css
.signed-out-board
.signed-out-copy
.signed-out-client-preview
.signed-out-client-card
```

The signed-out page should preview the same client/download model while keeping login/register immediately visible.

- [ ] **Step 4: Update responsive rules**

Ensure the existing `@media (max-width: 980px)` block stacks:

```css
.client-center
.client-platform-grid
.signed-out-client-preview
```

Expected: no text overlap, no clipped buttons, and the workspace remains usable on narrow screens.

### Task 5: Full Verification

**Files:**
- Verify only, no planned edits.

- [ ] **Step 1: Run unit tests**

Run:

```bash
cd web
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
cd web
npm run lint
```

Expected: type check passes.

- [ ] **Step 3: Start the dev server**

Run:

```bash
cd web
npm run dev
```

Expected: Next.js starts on an available localhost port.

- [ ] **Step 4: Browser verify signed-out and signed-in pages**

Open the app in a browser and verify:

- Signed-out page shows the login form and simplified client preview.
- Signed-in workspace shows the client center above the pet/material workspace.
- Material workflow strip includes the client preparation step.
- Desktop width and mobile width do not show clipped labels, overlapping controls, or console errors.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add docs/superpowers/plans/2026-06-22-front-ui-redesign.md web/src/app/page.tsx web/src/app/globals.css web/src/components/studio/studio-app.tsx web/src/lib/studio-layout.ts web/src/lib/studio-layout.test.ts
git commit -m "Redesign front studio workspace"
```
