# DesktopPet Web

网页端负责账号、积分、生成任务和云端素材库。Mac App 保持轻量，只负责桌面显示、本地素材导入、好友托管同步和播放。

## Local Development

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## First MVP

- Auth UI placeholder
- Pet material generation studio UI
- Mock generation API routes
- Mock job polling route
- Mock friends and hosting routes

## Deployment

Deploy this folder as a Vercel project with **Root Directory** set to `web`.

See [`../docs/deployment.md`](../docs/deployment.md) for the Vercel + Supabase deployment plan and China-access fallback path.
