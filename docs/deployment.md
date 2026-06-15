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
Inspector: https://vercel.com/guoyaowens-projects/web/FDEZNTSoq5TBrw8qyHZwVpkh2aWY
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
SUPABASE_SOURCE_IMAGE_BUCKET
SUPABASE_FRONT_IMAGE_BUCKET
SUPABASE_ACTION_VIDEO_BUCKET
SUPABASE_ASSET_BUNDLE_BUCKET
```

4. Apply the schema in `docs/schema.sql`.
5. Keep service-role keys only in Vercel server env. Never expose them in the Mac app.

## API Routes In This MVP

```text
GET  /api/health
GET  /api/studio/bootstrap
GET  /api/pets
GET  /api/pets/:petId/materials
GET  /api/friends
GET  /api/hosting/requests
POST /api/hosting/requests
PATCH /api/hosting/requests/:requestId
POST /api/hosting/recall
POST /api/upload-url
POST /api/generation/front-image
POST /api/generation/action-video
GET  /api/jobs/:jobId
```

These routes are mock-first. The next step is replacing the mock bodies with Supabase writes and provider calls.

Recommended replacement order:

1. Replace `/api/upload-url` with Supabase Storage signed upload URLs.
2. Replace `/api/generation/front-image` with a real server-side GPT Image job.
3. Replace `/api/generation/action-video` with a real server-side JiMeng job.
4. Store every job in Postgres and make `/api/jobs/:jobId` read real job status.
5. Store generated videos in Supabase Storage and register them through `/api/pets/:petId/materials`.
6. Add auth checks to every route before opening the web studio to real users.

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
