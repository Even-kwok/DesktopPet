import { sanitizeRedirectPath } from "@/lib/auth-policy";

type CheckEmailPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = (await searchParams) ?? {};
  const email = firstParam(params.email) ?? "你的邮箱";
  const next = sanitizeRedirectPath(firstParam(params.next), "/");

  return (
    <main className="auth-status-shell">
      <section className="auth-status-panel">
        <div className="auth-status-mark">✓</div>
        <span className="eyebrow">DesktopPet Studio</span>
        <h1>去邮箱确认账号</h1>
        <p className="auth-status-detail">
          确认邮件已发送到 <strong>{email}</strong>。点击邮件里的确认链接后，会回到确认成功页面。
        </p>
        <div className="auth-status-actions">
          <a className="button" href={loginHref(next)}>
            我已确认，去登录
          </a>
          <a className="button ghost" href="/">
            返回首页
          </a>
        </div>
      </section>
    </main>
  );
}

function loginHref(next: string) {
  const query = new URLSearchParams();

  query.set("auth", "login");

  if (next !== "/") {
    query.set("next", next);
  }

  return `/?${query.toString()}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
