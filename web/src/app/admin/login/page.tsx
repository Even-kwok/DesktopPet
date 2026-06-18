import { redirect } from "next/navigation";
import { sanitizeRedirectPath } from "@/lib/auth-policy";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { getBackendStatus } from "@/lib/supabase/server";

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = (await searchParams) ?? {};
  const next = sanitizeRedirectPath(firstParam(params.next), "/admin");
  const auth = await getCurrentAuthContext();

  if (auth.user && auth.isAdmin) {
    redirect(next);
  }

  const backend = getBackendStatus();
  const error = firstParam(params.error);

  return (
    <main className="login-shell admin-login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span className="login-mark admin">A</span>
          <div>
            <p className="admin-kicker">CatDesktopPet Admin</p>
            <h1>后台登录</h1>
          </div>
        </div>
        <p className="login-copy">后台只允许管理员账号进入，用于管理用户、猫咪、素材库配置、积分和寄养数据。</p>
        {auth.user && !auth.isAdmin ? <p className="login-error">当前账号没有后台权限，请切换管理员账号。</p> : null}
        {error ? <p className="login-error">{error}</p> : null}
        <form className="login-form" action="/api/auth/admin/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            <span>后台邮箱</span>
            <input
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={backend.authConfigured ? "" : "admin@desktop.pet"}
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue={backend.authConfigured ? "" : "123456"}
              required
            />
          </label>
          <button className="button" type="submit">
            登录后台
          </button>
        </form>
        {!backend.authConfigured ? (
          <p className="login-hint">当前是预览模式，已填入后台测试账号。真实环境请在 Supabase `app_metadata.role` 或 `ADMIN_EMAILS` 里授权。</p>
        ) : (
          <p className="login-hint">后台权限来自 Supabase app metadata 或服务端 ADMIN_EMAILS 白名单。</p>
        )}
        <a className="login-link" href="/login">
          返回用户登录
        </a>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
