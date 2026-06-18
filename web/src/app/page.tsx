import { StudioApp } from "@/components/studio/studio-app";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🐱</div>
          <div>
            <h1>DesktopPet Studio</h1>
          </div>
        </div>

        <form className="top-auth-form" method="post">
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
            autoComplete="current-password"
            defaultValue={backend.authConfigured ? "" : "123456"}
            placeholder="密码"
            required
          />
          <button className="button" formAction="/api/auth/login" type="submit">
            登录
          </button>
          <button className="button secondary" formAction="/api/auth/register" type="submit">
            注册
          </button>
          <a className="button ghost admin-entry-button" href="/admin/login">
            后台
          </a>
        </form>
      </header>

      {error ? <p className="auth-message error">{error}</p> : null}
      {notice ? <p className="auth-message success">{notice}</p> : null}

      <section className="panel signed-out-board">
        <div className="signed-out-copy">
          <span className="panel-icon">🐾</span>
          <h2>登录后进入你的桌宠工作台</h2>
          <p>网页端管理账号、积分和素材生成；Mac App 同步后负责显示、陪伴和托管。</p>
        </div>
        <div className="signed-out-preview" aria-hidden="true">
          <strong>🐈</strong>
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
