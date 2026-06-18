import type { ReactNode } from "react";
import { GenerationSettingsEditor } from "@/components/admin/generation-settings-editor";
import { MaterialLibraryEditor } from "@/components/admin/material-library-editor";
import { UserCreditEditor } from "@/components/admin/user-credit-editor";
import { buildAdminOverview } from "@/lib/admin-overview";
import { materialGroups } from "@/lib/material-slots";
import { loadAdminAccountDataState } from "@/lib/server/account-data-store";
import { requireAdminPage } from "@/lib/server/auth";
import { loadVideoGenerationSettings } from "@/lib/server/generation-settings-store";
import {
  listAdminMaterialLibraryConfigs,
  listPublicMaterialSlots
} from "@/lib/server/material-library-store";
import { getBackendStatus } from "@/lib/supabase/server";
import type { BackendStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const auth = await requireAdminPage("/admin");
  const [adminMaterialConfigs, publicMaterialSlots, accountState, videoGenerationSettings] = await Promise.all([
    listAdminMaterialLibraryConfigs(),
    listPublicMaterialSlots(),
    loadAdminAccountDataState(),
    loadVideoGenerationSettings()
  ]);
  const overview = buildAdminOverview({
    users: accountState.users,
    pets: accountState.pets,
    assets: accountState.assets,
    friends: accountState.friends,
    hostingRequests: accountState.hostingRequests,
    materialSlots: publicMaterialSlots,
    materialGroups
  });
  const backend = getBackendStatus();

  const materialNameByCode = new Map(
    overview.materialLibrary.map((material) => [material.code, material.name])
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">CatDesktopPet Admin</p>
          <h1>运营管理总览</h1>
          <p>用户、猫咪、素材、积分、充值、好友、寄养和素材库配置先统一到这张后台地图里。</p>
        </div>
        <div className="admin-actions">
          <span>{auth.user.email}</span>
          <a className="button secondary" href="/">
            返回工作台
          </a>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="next" value="/admin/login" />
            <button className="button ghost" type="submit">
              退出后台
            </button>
          </form>
        </div>
      </header>

      <section className="admin-metrics">
        <Metric label="用户" value={overview.metrics.users} />
        <Metric label="猫咪" value={overview.metrics.pets} />
        <Metric label="积分余额" value={overview.metrics.totalCredits} />
        <Metric label="充值记录" value={overview.metrics.rechargeRecords} />
        <Metric label="素材配置" value={overview.metrics.materialSlots} />
      </section>

      <section className="admin-section admin-section-wide admin-backend-section">
        <h2>后端状态</h2>
        <BackendStatusPanel backend={backend} />
      </section>

      <section className="admin-grid">
        <AdminSection title="用户账号">
          <UserCreditEditor users={overview.users} />
        </AdminSection>

        <AdminSection title="猫咪归属">
          <DataTable
            columns={["编号", "名字", "Owner", "Host", "状态"]}
            rows={overview.pets.map((pet) => [
              pet.petNumber,
              pet.name,
              pet.ownerUserId,
              pet.currentHostUserId ?? "-",
              pet.locationStatus
            ])}
          />
        </AdminSection>

        <AdminSection title="猫咪素材">
          <DataTable
            columns={["猫咪", "素材", "状态", "Provider"]}
            rows={overview.materials.slice(0, 10).map((material) => [
              material.petId,
              materialNameByCode.get(material.slot) ?? material.slot,
              materialStatusLabel(material.status),
              material.generationProvider ?? "-"
            ])}
          />
        </AdminSection>

        <AdminSection title="积分与充值">
          <DataTable
            columns={["用户", "金额", "授予积分", "状态"]}
            rows={overview.rechargeRecords.map((record) => [
              record.userId,
              `${record.amountCents / 100} ${record.currency}`,
              String(record.creditsGranted),
              record.status
            ])}
          />
        </AdminSection>

        <AdminSection title="好友与寄养">
          <DataTable
            columns={["好友", "在线", "托管数", "关系"]}
            rows={overview.friendships.map((friendship) => [
              friendship.friendName,
              friendship.friendStatus,
              String(friendship.hostedPets),
              friendship.status
            ])}
          />
          <div className="admin-list">
            {overview.hostingRequests.map((request) => (
              <div className="admin-list-row" key={request.id}>
                <strong>{request.petName}</strong>
                <span>{request.from}</span>
                <span>{request.status}</span>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="生成全局设置" wide>
          <GenerationSettingsEditor initialSettings={videoGenerationSettings} />
        </AdminSection>

        <AdminSection title="素材库配置" wide>
          <MaterialLibraryEditor groups={materialGroups} initialMaterials={adminMaterialConfigs} />
        </AdminSection>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BackendStatusPanel({ backend }: { backend: BackendStatus }) {
  const isLive = backend.mode === "supabase";

  return (
    <>
      <div className="backend-grid admin-backend-grid">
        <div>
          <span>模式</span>
          <strong>{isLive ? "Supabase" : "Mock"}</strong>
        </div>
        <div>
          <span>Auth</span>
          <strong>{backend.authConfigured ? "已配置" : "未配置"}</strong>
        </div>
        <div>
          <span>Storage</span>
          <strong>{backend.storageConfigured ? "已连接" : "Mock"}</strong>
        </div>
        <div>
          <span>Service Role</span>
          <strong>
            {backend.serviceRoleLooksValid ? "已识别" : backend.serviceRoleConfigured ? "未识别" : "未配置"}
          </strong>
        </div>
        <div>
          <span>原图 bucket</span>
          <strong>{backend.sourceImageBucket}</strong>
        </div>
        <div>
          <span>正面图 bucket</span>
          <strong>{backend.frontImageBucket}</strong>
        </div>
        <div>
          <span>动作视频 bucket</span>
          <strong>{backend.actionVideoBucket}</strong>
        </div>
        <div>
          <span>缺失环境变量</span>
          <strong>{backend.missingEnv.length > 0 ? backend.missingEnv.join(" / ") : "无"}</strong>
        </div>
      </div>
      {!backend.serviceRoleLooksValid && backend.serviceRoleConfigured ? (
        <p className="backend-warning">SUPABASE_SERVICE_ROLE_KEY 已填写，但不是 service_role key。</p>
      ) : backend.missingEnv.length > 0 ? (
        <p className="backend-warning">待配置：{backend.missingEnv.join(" / ")}</p>
      ) : (
        <p className="backend-ok">环境变量已就绪，可以写入 Supabase。</p>
      )}
    </>
  );
}

function AdminSection({
  title,
  children,
  wide = false
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={wide ? "admin-section admin-section-wide" : "admin-section"}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function materialStatusLabel(status: string) {
  if (status === "ready") {
    return "已生成";
  }

  if (status === "generating") {
    return "生成中";
  }

  return "未生成";
}
