import { StudioApp } from "@/components/studio/studio-app";
import {
  buildSignedOutAuthModeHref,
  resolveSignedOutAuthMode
} from "@/lib/auth-entry";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { buildClientPlatformCards, resolveWindowsClientDownloadUrl } from "@/lib/studio-layout";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { getStudioBootstrap } from "@/lib/server/studio-data";
import { getBackendStatus } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: HomePageProps) {
  const [auth, params] = await Promise.all([
    getCurrentAuthContext(),
    searchParams ?? Promise.resolve({})
  ]);

  if (!auth.user) {
    return <SignedOutHome params={params} />;
  }

  return <StudioApp initialData={await getStudioBootstrap(auth.user)} />;
}

function SignedOutHome({ params }: { params: Record<string, string | string[] | undefined> }) {
  const backend = getBackendStatus();
  const error = firstParam(params.error);
  const notice = firstParam(params.notice);
  const next = sanitizeRedirectPath(firstParam(params.next), "/");
  const authMode = resolveSignedOutAuthMode(firstParam(params.auth));
  const clientCards = buildClientPlatformCards(
    process.env.NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL?.trim() || null,
    resolveWindowsClientDownloadUrl(process.env.NEXT_PUBLIC_WINDOWS_CLIENT_DOWNLOAD_URL)
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🐱</div>
          <div>
            <h1>DesktopPet Studio</h1>
          </div>
        </div>

        <form
          action={authMode === "register" ? "/api/auth/register" : "/api/auth/login"}
          className="top-auth-form"
          method="post"
        >
          <input type="hidden" name="next" value={next} />
          <input
            aria-label="邮箱"
            className="input top-auth-input"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={backend.authConfigured ? "" : "demo@desktop.pet"}
            placeholder="邮箱"
            required
          />
          <input
            aria-label="密码"
            className="input top-auth-input"
            name="password"
            type="password"
            autoComplete={authMode === "register" ? "new-password" : "current-password"}
            defaultValue={backend.authConfigured ? "" : "123456"}
            placeholder="密码"
            required
          />
          {authMode === "register" ? (
            <>
              <input
                aria-label="确认密码"
                className="input top-auth-input"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                defaultValue={backend.authConfigured ? "" : "123456"}
                placeholder="确认密码"
                required
              />
              <input
                aria-label="推荐码"
                className="input top-auth-input referral-code-input"
                name="referralCode"
                type="text"
                autoComplete="off"
                placeholder="推荐码（选填）"
              />
            </>
          ) : null}
          <button className="button" type="submit">
            {authMode === "register" ? "注册" : "登录"}
          </button>
          <a
            className="button secondary auth-mode-switch"
            href={buildSignedOutAuthModeHref(authMode === "register" ? "login" : "register", next)}
          >
            {authMode === "register" ? "去登录" : "注册"}
          </a>
          <a className="button ghost admin-entry-button" href="/admin/login">
            后台
          </a>
        </form>
      </header>

      {error ? <p className="auth-message error">{error}</p> : null}
      {notice ? <p className="auth-message success">{notice}</p> : null}

      <section className="panel signed-out-board">
        <div className="signed-out-copy">
          <span className="eyebrow">DesktopPet Studio</span>
          <h2>生成动作素材，再把宠物同步到桌面</h2>
          <p>上传绿幕猫咪图，补齐基础动作，之后通过客户端把会动的小家伙放到你的设备上。</p>
        </div>
        <div className="signed-out-client-preview" aria-label="客户端入口预览">
          {clientCards.map((card) => (
            <div
              className={[
                "signed-out-client-card",
                card.id === "mac" ? "priority" : "",
                card.isEnabled ? "enabled" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              key={card.id}
            >
              <strong>{card.title}</strong>
              <span>{card.statusLabel}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
