import { sanitizeRedirectPath } from "@/lib/auth-policy";

type ConfirmedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function ConfirmedPage({ searchParams }: ConfirmedPageProps) {
  const params = (await searchParams) ?? {};
  const status = firstParam(params.status) === "error" ? "error" : "success";
  const next = sanitizeRedirectPath(firstParam(params.next), "/");
  const isSuccess = status === "success";

  return (
    <main className="auth-status-shell">
      <section className="auth-status-panel">
        <div className={isSuccess ? "auth-status-mark" : "auth-status-mark error"}>
          {isSuccess ? "✓" : "!"}
        </div>
        <span className="eyebrow">DesktopPet Studio</span>
        <h1>{isSuccess ? "邮箱确认成功" : "确认链接无效"}</h1>
        <p className="auth-status-detail">
          {isSuccess
            ? "账号已经完成邮箱确认，可以进入工作台。"
            : "确认链接可能已过期或已经使用过，请回到登录页重新操作。"}
        </p>
        <div className="auth-status-actions">
          <a className="button" href={isSuccess ? next : "/?auth=login"}>
            {isSuccess ? "进入工作台" : "返回登录"}
          </a>
          {isSuccess ? (
            <a className="button ghost" href="/?auth=login">
              去登录
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
