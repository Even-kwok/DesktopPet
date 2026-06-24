# DesktopPet Web

网页端负责账号、积分、生成任务和云端素材库。Mac / Windows 桌面 App 保持轻量，只负责桌面显示、本地素材导入、好友托管同步和播放。

## Local Development

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

Set `NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL` and `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL` in `.env.local` to enable the corresponding desktop download buttons in the client center.

## Windows Test Download

The Windows card becomes downloadable when `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL` points at a public ZIP URL.

Recommended first-test flow:

1. Build the package from the repository root:

   ```bash
   cd windows
   npm ci
   npm run dist:win
   ```

2. Upload `windows/release/CatDesktopPet-win-x64.zip` to a public file URL, or manually run the **Windows Desktop Artifact** GitHub Actions workflow to update this prerelease asset:

   ```text
   https://github.com/Even-kwok/DesktopPet/releases/download/windows-test/CatDesktopPet-win-x64.zip
   ```

3. Add the public ZIP URL to Vercel production as `NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL`.
4. Redeploy the `web` Vercel project.
5. Open the production site on Windows and use the `下载 Windows 版` button from the client center.

## First MVP

- User login at `/login`, admin login at `/admin/login`, shared logout route, and server-side cookie/session checks
- Pet material generation studio UI
- Desktop sync bundle at `/api/desktop/pets`, including account, pet number, ownership, host, display state, and ready video materials
- Admin overview page at `/admin` backed by `/api/admin/overview` and the same typed data contract
- Backend status indicator for mock vs Supabase mode
- Source image upload route, ready to write into Supabase Storage when env vars are configured
- Mock generation API routes
- Mock job polling route
- Mock friends and hosting routes

## Admin Data Domains

The `/admin` page starts as a read-only overview. It should grow into management for these domains:

- 用户账号：profile、email、账号状态、头像、创建时间
- 猫咪：UUID、`petNumber`、owner、current host、名字、物种、状态、图片
- 猫咪素材：pet + 素材代码标识、状态、视频 URL、provider job、服务端提示词快照、生成参数快照
- 积分：当前余额、积分流水、生成扣费原因
- 充值记录：支付 provider、金额、授予积分、支付状态、外部交易号
- 好友系统：好友申请、好友关系、在线/离线展示
- 托管系统：寄养请求、接收/拒绝/送回/召回状态
- 素材库配置：中文素材名、代码标识、分组用途、客户端固定触发说明、按时长计算的积分、生成时长、管理员可编辑完整提示词、生成参数、启用状态

素材库配置由服务端数据源提供。Mock 阶段用服务端内存 store 模拟数据库；Supabase 配置后由 `material_slot_definitions` 私有表读写。用户工作台和桌面同步只接收公开字段，不下发完整提示词。

## Auth

Local preview works without Supabase env vars:

- User workspace: `demo@desktop.pet / 123456`
- Admin backend: `admin@desktop.pet / 123456`

When Supabase is configured, `/login` and `/admin/login` use Supabase Auth email/password login through server-side cookies. Admin authorization must live in Supabase `app_metadata` (`role: "admin"`, `roles: ["admin"]`, or `is_admin: true`) or in the server-only comma-separated `ADMIN_EMAILS` env var. Do not use `user_metadata` for authorization because users can edit it.

## Deployment

Deploy this folder as a Vercel project with **Root Directory** set to `web`.

See [`../docs/deployment.md`](../docs/deployment.md) for the Vercel + Supabase deployment plan and China-access fallback path.
