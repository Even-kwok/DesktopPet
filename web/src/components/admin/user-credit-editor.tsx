"use client";

import { useState } from "react";
import type { AdminOverview } from "@/lib/admin-overview";

type AdminUser = AdminOverview["users"][number];

type CreditAdjustmentResult = {
  userId: string;
  amount: number;
  reason: string;
  previousBalance: number;
  balance: number;
  adjustedAt: string;
};

type UserDeleteResult = {
  deletedUserId: string;
  deletedPets: number;
  deletedAssets: number;
};

type RowDraft = {
  amount: string;
  reason: string;
  deleteConfirmation: string;
};

type SaveState = {
  tone: "saving" | "saved" | "error";
  text: string;
};

export function UserCreditEditor({
  users: initialUsers,
  currentAdminUserId
}: {
  users: AdminUser[];
  currentAdminUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  function updateDraft(userId: string, patch: Partial<RowDraft>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        amount: current[userId]?.amount ?? "",
        reason: current[userId]?.reason ?? "",
        deleteConfirmation: current[userId]?.deleteConfirmation ?? "",
        ...patch
      }
    }));
  }

  async function saveAdjustment(user: AdminUser) {
    const draft = drafts[user.id] ?? { amount: "", reason: "" };
    const amount = parseSignedInteger(draft.amount);
    const reason = draft.reason.trim();

    if (amount === null) {
      setSaveStates((current) => ({
        ...current,
        [user.id]: { tone: "error", text: "请输入非 0 整数" }
      }));
      return;
    }

    if (!reason) {
      setSaveStates((current) => ({
        ...current,
        [user.id]: { tone: "error", text: "请填写原因" }
      }));
      return;
    }

    setSaveStates((current) => ({
      ...current,
      [user.id]: { tone: "saving", text: "保存中" }
    }));

    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/credits`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        amount,
        reason
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveStates((current) => ({
        ...current,
        [user.id]: {
          tone: "error",
          text: payload?.details?.formErrors?.[0] ?? payload?.error ?? "保存失败"
        }
      }));
      return;
    }

    const adjustment = payload as CreditAdjustmentResult;

    setUsers((currentUsers) =>
      currentUsers.map((item) =>
        item.id === adjustment.userId
          ? {
              ...item,
              creditBalance: adjustment.balance
            }
          : item
      )
    );
    setDrafts((current) => ({
      ...current,
      [user.id]: { amount: "", reason: "", deleteConfirmation: current[user.id]?.deleteConfirmation ?? "" }
    }));
    setSaveStates((current) => ({
      ...current,
      [user.id]: {
        tone: "saved",
        text: `已调整 ${formatSigned(adjustment.amount)}`
      }
    }));
  }

  async function deleteUser(user: AdminUser) {
    const draft = drafts[user.id] ?? { amount: "", reason: "", deleteConfirmation: "" };

    if (draft.deleteConfirmation.trim() !== "DELETE") {
      setSaveStates((current) => ({
        ...current,
        [user.id]: { tone: "error", text: "输入 DELETE 后再删除" }
      }));
      return;
    }

    setSaveStates((current) => ({
      ...current,
      [user.id]: { tone: "saving", text: "删除中" }
    }));

    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "DELETE",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        confirmation: "DELETE"
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveStates((current) => ({
        ...current,
        [user.id]: {
          tone: "error",
          text: payload?.details ?? payload?.error ?? "删除失败"
        }
      }));
      return;
    }

    const result = payload as UserDeleteResult;

    setUsers((currentUsers) => currentUsers.filter((item) => item.id !== result.deletedUserId));
    setDeleteUserId(null);
    setSaveStates((current) => ({
      ...current,
      [user.id]: {
        tone: "saved",
        text: `已删除用户和 ${result.deletedPets} 只猫咪`
      }
    }));
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-credit-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>邮箱</th>
            <th>猫咪数</th>
            <th>已消耗积分</th>
            <th>素材数</th>
            <th>余额</th>
            <th>调整</th>
            <th>原因</th>
            <th>操作</th>
            <th>危险操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const draft = drafts[user.id] ?? { amount: "", reason: "", deleteConfirmation: "" };
            const saveState = saveStates[user.id];
            const isSelf = user.id === currentAdminUserId;
            const isDeleting = deleteUserId === user.id;

            return (
              <tr key={user.id}>
                <td>{user.displayName}</td>
                <td>{user.email}</td>
                <td>{user.petCount}</td>
                <td>{user.consumedCredits}</td>
                <td>{user.materialCount}</td>
                <td>
                  <strong>{user.creditBalance}</strong>
                </td>
                <td>
                  <input
                    className="input admin-credit-amount-input"
                    inputMode="numeric"
                    placeholder="+100 / -50"
                    value={draft.amount}
                    onChange={(event) => updateDraft(user.id, { amount: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="input admin-credit-reason-input"
                    maxLength={160}
                    placeholder="调整原因"
                    value={draft.reason}
                    onChange={(event) => updateDraft(user.id, { reason: event.target.value })}
                  />
                </td>
                <td>
                  <div className="admin-credit-actions">
                    <button
                      className="button"
                      disabled={saveState?.tone === "saving"}
                      onClick={() => void saveAdjustment(user)}
                      type="button"
                    >
                      保存
                    </button>
                    {saveState ? (
                      <span className={`admin-save-state ${saveState.tone}`}>{saveState.text}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  {isSelf ? (
                    <span className="admin-save-state">当前账号</span>
                  ) : isDeleting ? (
                    <div className="admin-credit-actions admin-danger-actions">
                      <input
                        className="input admin-credit-reason-input"
                        placeholder="输入 DELETE"
                        value={draft.deleteConfirmation}
                        onChange={(event) =>
                          updateDraft(user.id, { deleteConfirmation: event.target.value })
                        }
                      />
                      <button
                        className="button danger"
                        disabled={saveState?.tone === "saving"}
                        type="button"
                        onClick={() => void deleteUser(user)}
                      >
                        确认删除
                      </button>
                      <button
                        className="button ghost"
                        disabled={saveState?.tone === "saving"}
                        type="button"
                        onClick={() => setDeleteUserId(null)}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button danger"
                      type="button"
                      onClick={() => setDeleteUserId(user.id)}
                    >
                      删除用户
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseSignedInteger(value: string) {
  const trimmed = value.trim();

  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }

  const amount = Number(trimmed);

  return Number.isInteger(amount) && amount !== 0 ? amount : null;
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
