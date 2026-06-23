"use client";

import { useState } from "react";
import type { AdminOverview } from "@/lib/admin-overview";
import { formatCnyFromCents } from "@/lib/referral";
import type {
  RechargeRecord,
  ReferralCode,
  ReferralRewardLedgerEntry,
  ReferralSettings
} from "@/lib/types";

type AdminUser = AdminOverview["users"][number];

type SaveState = {
  tone: "idle" | "saving" | "saved" | "error";
  text: string;
};

export function ReferralAdminPanel({
  users,
  initialSettings,
  initialCodes,
  initialRechargeRecords,
  initialRewards
}: {
  users: AdminUser[];
  initialSettings: ReferralSettings;
  initialCodes: ReferralCode[];
  initialRechargeRecords: RechargeRecord[];
  initialRewards: ReferralRewardLedgerEntry[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [codes, setCodes] = useState(initialCodes);
  const [rechargeRecords, setRechargeRecords] = useState(initialRechargeRecords);
  const [rewards, setRewards] = useState(initialRewards);
  const [settingsState, setSettingsState] = useState<SaveState>({
    tone: "idle",
    text: "修改后自动保存"
  });
  const [codeDraft, setCodeDraft] = useState({
    ownerUserId: users[0]?.id ?? "",
    code: ""
  });
  const [codeState, setCodeState] = useState<SaveState>({
    tone: "idle",
    text: "等待创建"
  });
  const [rechargeDraft, setRechargeDraft] = useState({
    userId: users[0]?.id ?? "",
    amountYuan: "99",
    creditsGranted: "1200",
    status: "paid",
    note: ""
  });
  const [rechargeState, setRechargeState] = useState<SaveState>({
    tone: "idle",
    text: "等待记录"
  });

  async function updateSettings(patch: Partial<ReferralSettings>) {
    const nextSettings = { ...settings, ...patch };

    setSettings(nextSettings);
    setSettingsState({ tone: "saving", text: "保存中" });

    const response = await fetch("/api/admin/referral/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nextSettings)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSettingsState({ tone: "error", text: payload?.error ?? "保存失败" });
      return;
    }

    setSettings(payload as ReferralSettings);
    setSettingsState({ tone: "saved", text: "已保存" });
  }

  async function createCode() {
    if (!codeDraft.ownerUserId || !codeDraft.code.trim()) {
      setCodeState({ tone: "error", text: "请选择码主并填写推荐码" });
      return;
    }

    setCodeState({ tone: "saving", text: "创建中" });

    const response = await fetch("/api/admin/referral/codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(codeDraft)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setCodeState({ tone: "error", text: payload?.error ?? "创建失败" });
      return;
    }

    setCodes((current) => [payload as ReferralCode, ...current]);
    setCodeDraft((current) => ({ ...current, code: "" }));
    setCodeState({ tone: "saved", text: "已创建" });
  }

  async function updateCodeStatus(code: ReferralCode) {
    const nextStatus = code.status === "active" ? "disabled" : "active";

    const response = await fetch(`/api/admin/referral/codes/${encodeURIComponent(code.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setCodeState({ tone: "error", text: payload?.error ?? "更新失败" });
      return;
    }

    const updatedCode = payload as ReferralCode;

    setCodes((current) =>
      current.map((item) => (item.id === updatedCode.id ? updatedCode : item))
    );
    setCodeState({ tone: "saved", text: "状态已更新" });
  }

  async function recordRecharge() {
    const amountCents = parseYuanToCents(rechargeDraft.amountYuan);
    const creditsGranted = parseInteger(rechargeDraft.creditsGranted);

    if (!rechargeDraft.userId || amountCents === null || creditsGranted === null) {
      setRechargeState({ tone: "error", text: "请填写有效充值信息" });
      return;
    }

    setRechargeState({ tone: "saving", text: "保存中" });

    const response = await fetch("/api/admin/recharges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: rechargeDraft.userId,
        amountCents,
        creditsGranted,
        status: rechargeDraft.status,
        note: rechargeDraft.note.trim() || undefined
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setRechargeState({ tone: "error", text: payload?.error ?? "保存失败" });
      return;
    }

    const result = payload as {
      recharge: RechargeRecord;
      reward: ReferralRewardLedgerEntry | null;
    };

    setRechargeRecords((current) => [
      result.recharge,
      ...current.filter((record) => record.id !== result.recharge.id)
    ]);

    const postedReward = result.reward;

    if (postedReward) {
      setRewards((current) => [
        postedReward,
        ...current.filter((reward) => reward.id !== postedReward.id)
      ]);
    }

    setRechargeState({
      tone: "saved",
      text: result.reward ? "已记录并生成推荐收益" : "已记录充值"
    });
  }

  return (
    <div className="admin-referral-panel">
      <div className="admin-generation-settings-head">
        <div>
          <p>
            推荐码由后台发放；被推荐用户首次充值享受优惠，码主获得独立推广收益凭据。
          </p>
        </div>
        <span className={`admin-settings-status ${settingsState.tone}`}>{settingsState.text}</span>
      </div>

      <div className="settings-grid admin-referral-settings">
        <label className="setting-field">
          <span>码主分成 %</span>
          <input
            className="input"
            inputMode="numeric"
            min={0}
            max={100}
            type="number"
            value={settings.rewardPercent}
            onChange={(event) =>
              void updateSettings({ rewardPercent: Number(event.target.value) })
            }
          />
        </label>
        <label className="setting-field">
          <span>首充优惠 %</span>
          <input
            className="input"
            inputMode="numeric"
            min={0}
            max={100}
            type="number"
            value={settings.firstRechargeDiscountPercent}
            onChange={(event) =>
              void updateSettings({ firstRechargeDiscountPercent: Number(event.target.value) })
            }
          />
        </label>
      </div>

      <div className="admin-referral-actions">
        <div className="admin-material-create-panel">
          <div className="admin-material-create-head">
            <h3>创建推荐码</h3>
            <span className={`admin-save-state ${codeState.tone}`}>{codeState.text}</span>
          </div>
          <div className="admin-referral-form-grid">
            <label className="setting-field">
              <span>码主</span>
              <select
                className="input"
                value={codeDraft.ownerUserId}
                onChange={(event) =>
                  setCodeDraft((current) => ({ ...current, ownerUserId: event.target.value }))
                }
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="setting-field">
              <span>推荐码</span>
              <input
                className="input"
                maxLength={32}
                placeholder="LIZI20"
                value={codeDraft.code}
                onChange={(event) =>
                  setCodeDraft((current) => ({ ...current, code: event.target.value }))
                }
              />
            </label>
            <button className="button" type="button" onClick={() => void createCode()}>
              创建
            </button>
          </div>
        </div>

        <div className="admin-material-create-panel">
          <div className="admin-material-create-head">
            <h3>记录充值</h3>
            <span className={`admin-save-state ${rechargeState.tone}`}>{rechargeState.text}</span>
          </div>
          <div className="admin-referral-form-grid recharge">
            <label className="setting-field">
              <span>用户</span>
              <select
                className="input"
                value={rechargeDraft.userId}
                onChange={(event) =>
                  setRechargeDraft((current) => ({ ...current, userId: event.target.value }))
                }
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} · {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="setting-field">
              <span>金额（元）</span>
              <input
                className="input"
                inputMode="decimal"
                value={rechargeDraft.amountYuan}
                onChange={(event) =>
                  setRechargeDraft((current) => ({ ...current, amountYuan: event.target.value }))
                }
              />
            </label>
            <label className="setting-field">
              <span>授予积分</span>
              <input
                className="input"
                inputMode="numeric"
                value={rechargeDraft.creditsGranted}
                onChange={(event) =>
                  setRechargeDraft((current) => ({ ...current, creditsGranted: event.target.value }))
                }
              />
            </label>
            <label className="setting-field">
              <span>状态</span>
              <select
                className="input"
                value={rechargeDraft.status}
                onChange={(event) =>
                  setRechargeDraft((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="paid">paid</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
              </select>
            </label>
            <label className="setting-field admin-referral-note-field">
              <span>备注</span>
              <input
                className="input"
                maxLength={160}
                value={rechargeDraft.note}
                onChange={(event) =>
                  setRechargeDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <button className="button" type="button" onClick={() => void recordRecharge()}>
              记录
            </button>
          </div>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>推荐码</th>
              <th>码主</th>
              <th>状态</th>
              <th>推荐注册</th>
              <th>收益凭据</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id}>
                <td>{code.code}</td>
                <td>{code.ownerName ?? code.ownerEmail ?? code.ownerUserId}</td>
                <td>{code.status}</td>
                <td>{code.referredUsers ?? 0}</td>
                <td>{formatCnyFromCents(code.rewardAmountCents ?? 0)}</td>
                <td>
                  <button className="button tiny secondary" type="button" onClick={() => void updateCodeStatus(code)}>
                    {code.status === "active" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-referral-tables">
        <DataTable
          title="充值记录"
          columns={["用户", "金额", "授予积分", "优惠", "状态"]}
          rows={rechargeRecords.map((record) => [
            userLabel(users, record.userId),
            formatCnyFromCents(record.amountCents),
            String(record.creditsGranted),
            `${record.discountPercent}% / ${formatCnyFromCents(record.discountAmountCents)}`,
            record.status
          ])}
        />
        <DataTable
          title="推荐收益流水"
          columns={["码主", "被推荐用户", "充值金额", "分成", "收益"]}
          rows={rewards.map((reward) => [
            reward.referrerName ?? reward.referrerEmail ?? reward.referrerUserId,
            reward.referredUserName ?? reward.referredUserEmail ?? reward.referredUserId,
            formatCnyFromCents(reward.amountCents),
            `${reward.rewardPercent}%`,
            formatCnyFromCents(reward.rewardAmountCents)
          ])}
        />
      </div>
    </div>
  );
}

function DataTable({
  title,
  columns,
  rows
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="admin-referral-mini-table">
      <h3>{title}</h3>
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
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, index) => (
                  <td key={`${cell}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseYuanToCents(value: string) {
  const amount = Number(value.trim());

  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

function parseInteger(value: string) {
  const amount = Number(value.trim());

  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function userLabel(users: AdminUser[], userId: string) {
  const user = users.find((item) => item.id === userId);

  return user ? `${user.displayName} · ${user.email}` : userId;
}
