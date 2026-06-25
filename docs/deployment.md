# DesktopPet Deployment Plan

## Recommendation For The First Public MVP

Use one repository and deploy the `web/` folder as a Vercel project.

```text
GitHub: Even-kwok/DesktopPet
  Package.swift / Sources/        macOS app
  web/                            Next.js web app + API routes
  docs/                           schema and deployment notes
```

For the first stage, use:

- **Web + API**: Vercel, root directory `web`
- **Auth + Database + Storage**: Supabase
- **Supabase region**: Singapore first
- **Vercel function region**: Singapore (`sin1`) first
- **AI providers**: called only from server routes, never from the Mac app

This keeps deployment simple while staying reasonably close to users in mainland China, Hong Kong, Taiwan, Singapore, Japan, and Korea.

Official references:

- Vercel regions: https://vercel.com/docs/regions
- Vercel project root directory: https://vercel.com/docs/deployments/configure-a-build#root-directory
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Supabase Storage: https://supabase.com/docs/guides/storage

## Domestic China Strategy

Vercel and Supabase can be used for the first MVP, but mainland China latency and stability must be measured with real users. Do not hard-code the product to either provider.

Keep these boundaries from day one:

```text
web/src/app/api/*       product API facade
web/src/lib/supabase/*  Supabase adapter
future src/lib/storage  storage adapter
future src/lib/ai       OpenAI / JiMeng adapter
```

If mainland access is not stable enough, keep the global stack and add a China stack:

```text
Global users:
  Vercel + Supabase Singapore

Mainland China users:
  Tencent Cloud EdgeOne / Alibaba Cloud CDN
  Tencent CloudBase / Alibaba Cloud Function Compute
  COS / OSS for videos
  TencentDB / PolarDB / Supabase-compatible Postgres alternative
```

The product API paths should stay the same, so the Mac App only changes its API base URL.

## Vercel Setup

Current deployment:

```text
Team: guoyaowens-projects
Project: web
Project ID: prj_eK7l5ukD6Yc5WuSog21Mzedr2uWA
Production URL: https://web-guoyaowens-projects.vercel.app
Deployments: https://vercel.com/guoyaowens-projects/web/deployments
```

The production `vercel.app` URL is public. SSO deployment protection has been disabled for this project. Git fork protection remains enabled.

1. Import `Even-kwok/DesktopPet` in Vercel.
2. Set **Root Directory** to `web`.
3. Build command: `npm run build`.
4. Install command: `npm install`.
5. Add environment variables from `web/.env.example`.
6. Use Singapore for the first function region.
7. Deploy Preview first, then Production.

Local bootstrap:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project in Singapore.
2. Create these storage buckets:

```text
source-images
front-images
action-videos
asset-bundles
```

3. Add env vars to Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAILS
AUTH_MOCK_COOKIE_SECRET
INITIAL_CREDIT_BALANCE
SUPABASE_SOURCE_IMAGE_BUCKET
SUPABASE_FRONT_IMAGE_BUCKET
SUPABASE_ACTION_VIDEO_BUCKET
SUPABASE_ASSET_BUNDLE_BUCKET
```

4. Apply the schema in `docs/schema.sql`.
5. Keep service-role keys only in Vercel server env. Never expose them in the Mac app.
6. Grant admin access through Supabase `app_metadata.role = admin`, `app_metadata.roles = ["admin"]`, `app_metadata.is_admin = true`, or the server-only `ADMIN_EMAILS` allowlist. Never authorize admins from `user_metadata`.
7. New Supabase public tables need explicit `GRANT` statements in addition to RLS policies. The schema draft includes grants for authenticated app access and keeps service-role usage server-side.
8. Add the deployed site origin and `/auth/callback` URL to Supabase Auth redirect URLs, for example `https://your-preview.vercel.app/auth/callback`.

## API Routes In This MVP

```text
GET  /api/health
GET  /api/backend/status
GET  /login
GET  /admin/login
POST /api/auth/login
POST /api/auth/admin/login
POST /api/auth/logout
GET  /api/studio/bootstrap
GET  /api/admin/overview
GET  /api/pets
GET  /api/pets/:petId/materials
GET  /api/desktop/pets
POST /api/desktop/pets
GET  /api/friends
GET  /api/hosting/requests
POST /api/hosting/requests
PATCH /api/hosting/requests/:requestId
POST /api/hosting/recall
POST /api/upload-url
POST /api/source-images
POST /api/generation/front-image
POST /api/generation/action-video
GET  /api/jobs/:jobId
```

These routes are mock-first. The next step is replacing the mock bodies with Supabase writes and provider calls.

## Windows Client Test Download

The web client center defaults the Windows download button to the `windows-test` GitHub Release ZIP. `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL` can override this with another public ZIP URL.

First Windows testing flow:

1. Build the package locally if possible:

```bash
cd windows
npm ci
npm run dist:win
```

The expected output is:

```text
windows/release/CatDesktopPet-win-x64.zip
```

2. If local cross-packaging is not convenient, run GitHub Actions → **Windows Desktop Artifact**. It uses `windows-latest`, runs typecheck/tests, packages the client, uploads the `cat-desktop-pet-windows-x64` artifact, and on a manual run updates this prerelease asset:

```text
https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip
```

3. Redeploy the `web` project. If you want to use another public download URL, add it in Vercel production:

```text
NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL=https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip
```

4. The current linked Vercel project is:

```text
Team: guoyaowens-projects
Project: web
Project ID: prj_eK7l5ukD6Yc5WuSog21Mzedr2uWA
```

5. Open the production site from Windows, download the ZIP, extract it, and run `CatDesktopPet.exe`.

This test ZIP is intentionally unsigned. Windows may show SmartScreen or an unknown-publisher warning. After the manual Windows smoke test passes, prepare a signed installer/update path instead of treating the unsigned ZIP as a public production release.

Recommended replacement order:

1. Configure Supabase env vars and verify `/api/backend/status` switches from `mock` to `supabase`.
2. Use `/api/source-images` to upload source pet images into Supabase Storage.
3. Replace `/api/upload-url` with Supabase Storage signed upload URLs for larger direct-to-storage uploads.
4. Replace `/api/generation/front-image` with a real server-side GPT Image job.
5. Replace `/api/generation/action-video` with a real server-side JiMeng job.
6. Store every job in Postgres and make `/api/jobs/:jobId` read real job status.
7. Store generated videos in Supabase Storage and register them through `/api/pets/:petId/materials`.
8. Add auth checks to every route before opening the web studio to real users.

## Desktop Account Sync

The Mac app should use one account-scoped endpoint for material sync:

```text
GET /api/desktop/pets
```

The response includes:

- `account`: the signed-in account summary
- `sync`: backend mode and recommended poll interval
- `pets`: account pets with `id`, `petNumber`, owner id, current host id, ownership, display state, avatar URL, and ready materials

The Mac app downloads ready videos into local Application Support storage and then uses local file references for playback. A pet with `displayState = unavailable` stays in the account data but should not appear on the local desktop, which lets friend hosting move the visible pet between accounts.

During the placeholder phase, the Mac app stores only a mock account in UserDefaults. Real Supabase Auth should replace that local placeholder with a real session/token provider, while keeping `DesktopPetSyncClient.importLatestBundle` focused on bundle import.

## Admin Dashboard

The first admin page lives at:

```text
/admin
```

It is backed by:

```text
GET /api/admin/overview
```

It should grow into management for:

- users and account status
- pets, pet numbers, owners, and current hosts
- pet materials and generated asset metadata
- credit balances and credit ledger entries
- recharge/payment records
- friend requests and accepted friendships
- pet hosting requests
- material slot definitions, including Chinese display name, code identifier, group purpose, client-fixed trigger label, duration-based credit rule, admin-editable prompt template, and generation settings

The full `prompt_template` belongs in the private material-definition table and is read by server/admin routes only. Public user-facing material config should come from a projection that excludes the prompt template.

## JiMeng / Volcengine Video Provider

The action-video route supports a real provider when these Vercel env vars are set:

```text
mini_API_KEY
JIMENG_API_KEY
ARK_API_KEY
JIMENG_API_BASE_URL
JIMENG_QUERY_URL_TEMPLATE
JIMENG_VIDEO_MODEL
JIMENG_VIDEO_DURATION_SECONDS
JIMENG_VIDEO_CAMERA_FIXED
JIMENG_VIDEO_WATERMARK
GENERATION_JOB_TIMEOUT_SECONDS
GENERATION_JOB_RECOVERY_WINDOW_SECONDS
```

For the currently enabled Volcengine Ark model, use:

```text
JIMENG_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
JIMENG_QUERY_URL_TEMPLATE=https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{taskId}
JIMENG_VIDEO_MODEL=doubao-seedance-2-0-mini-260615
JIMENG_VIDEO_DURATION_SECONDS=10
JIMENG_VIDEO_CAMERA_FIXED=true
JIMENG_VIDEO_WATERMARK=false
GENERATION_JOB_TIMEOUT_SECONDS=1800
GENERATION_JOB_RECOVERY_WINDOW_SECONDS=86400
```

`JIMENG_API_BASE_URL` is the provider's create-task endpoint. `JIMENG_QUERY_URL_TEMPLATE` should contain `{taskId}` where the provider task id belongs. Keep API keys server-only and never expose them to the Mac app or browser.

The admin generation-settings panel defaults to `Doubao-Seedance-2.0-mini` (`doubao-seedance-2-0-mini-260615`) and can switch to `Doubao-Seedance-2.0-fast` (`doubao-seedance-2-0-fast-260128`) when needed. The server reads `mini_API_KEY`, `JIMENG_API_KEY`, `ARK_API_KEY`, `DOUBAO_SEEDANCE_API_KEY`, and compatible model-specific key aliases.

Generation jobs use a 30-minute local timeout by default. The task queue also re-checks expired Jimeng jobs for 24 hours, so a provider result that arrives shortly after the local timeout can still be restored on refresh.

When the env vars are missing, `/api/generation/action-video` stays in mock mode. When they are present, the route sends the uploaded pet image URL and the selected material slot prompt to the provider, then `/api/jobs/:jobId` polls provider status.

## Mac App Integration Later

Mac App should only call:

```text
GET /api/pets
GET /api/friends
GET /api/hosting/requests
GET /api/assets/:petId
POST /api/hosting/requests
PATCH /api/hosting/requests/:requestId
POST /api/hosting/recall
```

It should not call:

```text
OpenAI API
JiMeng API
payment APIs
credit mutation APIs
```

## China Access Test Checklist

Before deciding whether to add a domestic stack, test these from mainland China:

```text
homepage TTFB
/api/health latency
Supabase auth verification latency
image upload speed
video download speed
job polling stability
Mac App API sync stability
```

If homepage is okay but video is slow, move videos first to a China-friendly object storage/CDN. If API auth and job polling are unstable, add a China API deployment.
