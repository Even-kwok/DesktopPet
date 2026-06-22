"use client";

import { useMemo, useState } from "react";
import { materialCostLabel } from "@/lib/admin-material-table";
import {
  materialUnlockTiers,
  unlockTierForId,
  type MaterialLibraryConfig
} from "@/lib/material-library-config";
import type { MaterialGroup, MaterialGroupId, MaterialUnlockTier } from "@/lib/material-slots";

type SaveState = {
  code: string;
  tone: "saving" | "saved" | "error";
  text: string;
} | null;

type CreateMaterialDraft = {
  code: string;
  name: string;
  groupId: MaterialGroupId;
  unlockTier: MaterialUnlockTier;
  durationSeconds: number;
  creditsPerSecond: number;
  promptContent: string;
  enabled: boolean;
};

const libraryStateCode = "__library__";

export function MaterialLibraryEditor({
  groups,
  initialMaterials
}: {
  groups: MaterialGroup[];
  initialMaterials: MaterialLibraryConfig[];
}) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [createDraft, setCreateDraft] = useState(() => createEmptyMaterialDraft(groups));
  const [saveState, setSaveState] = useState<SaveState>(null);
  const groupedMaterials = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        materials: materials.filter((material) => material.group.id === group.id)
      })),
    [groups, materials]
  );

  function updateMaterial(code: string, patch: Partial<MaterialLibraryConfig>) {
    setMaterials((currentMaterials) =>
      currentMaterials.map((material) =>
        material.code === code ? { ...material, ...patch } : material
      )
    );
  }

  function updateCreateDraft(patch: Partial<CreateMaterialDraft>) {
    setCreateDraft((currentDraft) => ({ ...currentDraft, ...patch }));
  }

  async function createMaterial() {
    setSaveState({ code: libraryStateCode, tone: "saving", text: "新增中" });

    const response = await fetch("/api/admin/material-library", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(createDraft)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveState({
        code: libraryStateCode,
        tone: "error",
        text: materialMutationMessage(payload?.error, "新增失败")
      });
      return;
    }

    const created = payload as MaterialLibraryConfig;
    setMaterials((currentMaterials) => [...currentMaterials, created]);
    setCreateDraft(createEmptyMaterialDraft(groups));
    setSaveState({ code: libraryStateCode, tone: "saved", text: "已新增" });
  }

  async function saveMaterial(material: MaterialLibraryConfig) {
    setSaveState({ code: material.code, tone: "saving", text: "保存中" });

    const response = await fetch(`/api/admin/material-library/${encodeURIComponent(material.code)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: material.name,
        groupId: material.group.id,
        unlockTier: material.unlockTier.id,
        durationSeconds: material.durationSeconds,
        creditsPerSecond: material.creditsPerSecond,
        promptContent: material.promptContent,
        enabled: material.enabled
      })
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveState({
        code: material.code,
        tone: "error",
        text: payload?.error ?? "保存失败"
      });
      return;
    }

    const updated = payload as MaterialLibraryConfig;
    setMaterials((currentMaterials) =>
      currentMaterials.map((item) => (item.code === updated.code ? updated : item))
    );
    setSaveState({ code: material.code, tone: "saved", text: "已保存" });
  }

  async function deleteMaterial(material: MaterialLibraryConfig) {
    const confirmed = window.confirm(
      `删除「${material.name}」后，用户端将不再看到这个素材配置。\n\n确定删除？`
    );

    if (!confirmed) {
      setSaveState({ code: material.code, tone: "saved", text: "已取消" });
      return;
    }

    setSaveState({ code: material.code, tone: "saving", text: "删除中" });

    const response = await fetch(`/api/admin/material-library/${encodeURIComponent(material.code)}`, {
      method: "DELETE"
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveState({
        code: material.code,
        tone: "error",
        text: materialMutationMessage(payload?.error, "删除失败")
      });
      return;
    }

    setMaterials((currentMaterials) =>
      currentMaterials.filter((item) => item.code !== material.code)
    );
    setSaveState({ code: libraryStateCode, tone: "saved", text: "已删除" });
  }

  return (
    <div className="admin-material-groups">
      <section className="admin-material-create-panel">
        <div className="admin-material-create-head">
          <h3>新增素材</h3>
          {saveState?.code === libraryStateCode ? (
            <span className={`admin-save-state ${saveState.tone}`}>{saveState.text}</span>
          ) : null}
        </div>
        <div className="admin-material-create-grid">
          <label>
            <span>Code</span>
            <input
              className="input"
              placeholder="custom_action"
              value={createDraft.code}
              onChange={(event) => updateCreateDraft({ code: event.target.value })}
            />
          </label>
          <label>
            <span>名字</span>
            <input
              className="input"
              placeholder="新动作"
              value={createDraft.name}
              onChange={(event) => updateCreateDraft({ name: event.target.value })}
            />
          </label>
          <label>
            <span>分组</span>
            <select
              className="input"
              value={createDraft.groupId}
              onChange={(event) =>
                updateCreateDraft({ groupId: event.target.value as MaterialGroupId })
              }
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>版本</span>
            <select
              className="input"
              value={createDraft.unlockTier}
              onChange={(event) =>
                updateCreateDraft({ unlockTier: event.target.value as MaterialUnlockTier })
              }
            >
              {materialUnlockTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>时长</span>
            <input
              className="input"
              max={15}
              min={4}
              type="number"
              value={createDraft.durationSeconds}
              onChange={(event) =>
                updateCreateDraft({ durationSeconds: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>积分/秒</span>
            <input
              className="input"
              min={0}
              step={0.01}
              type="number"
              value={createDraft.creditsPerSecond}
              onChange={(event) =>
                updateCreateDraft({ creditsPerSecond: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>状态</span>
            <select
              className="input"
              value={createDraft.enabled ? "true" : "false"}
              onChange={(event) =>
                updateCreateDraft({ enabled: event.target.value === "true" })
              }
            >
              <option value="false">停用</option>
              <option value="true">启用</option>
            </select>
          </label>
          <label className="admin-material-create-prompt">
            <span>提示词</span>
            <textarea
              className="input"
              placeholder="固定摄像机视角..."
              value={createDraft.promptContent}
              onChange={(event) => updateCreateDraft({ promptContent: event.target.value })}
            />
          </label>
          <button className="button success" type="button" onClick={() => void createMaterial()}>
            新增
          </button>
        </div>
      </section>
      {groupedMaterials.map((group) => (
        <section className="admin-material-group" key={group.id}>
          <div className="admin-material-group-head">
            <div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <span>{group.materials.length} 个素材</span>
          </div>
          <div className="admin-material-table-wrap">
            <table className="admin-material-edit-table">
              <thead>
                <tr>
                  <th>素材</th>
                  <th>名字</th>
                  <th>分组</th>
                  <th>版本</th>
                  <th>触发条件</th>
                  <th>启用</th>
                  <th>时长</th>
                  <th>积分/秒</th>
                  <th>单次积分</th>
                  <th>提示词</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {group.materials.map((material) => (
                  <tr key={material.code}>
                    <td className="admin-material-code-cell">
                      <strong>{material.icon}</strong>
                      <code>{material.code}</code>
                    </td>
                    <td>
                      <input
                        className="input admin-material-name-input"
                        value={material.name}
                        onChange={(event) => updateMaterial(material.code, { name: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="input admin-material-select"
                        value={material.group.id}
                        onChange={(event) => {
                          const nextGroup = groups.find((item) => item.id === event.target.value);

                          if (nextGroup) {
                            updateMaterial(material.code, {
                              group: {
                                id: nextGroup.id,
                                name: nextGroup.title,
                                description: nextGroup.description
                              }
                            });
                          }
                        }}
                      >
                        {groups.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="input admin-material-tier-select"
                        title={material.unlockTier.description}
                        value={material.unlockTier.id}
                        onChange={(event) => {
                          updateMaterial(material.code, {
                            unlockTier: unlockTierForId(event.target.value as MaterialUnlockTier)
                          });
                        }}
                      >
                        {materialUnlockTiers.map((tier) => (
                          <option key={tier.id} value={tier.id}>
                            {tier.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input admin-material-trigger-input"
                        readOnly
                        title={material.trigger.note}
                        value={material.trigger.label}
                      />
                    </td>
                    <td>
                      <select
                        className="input admin-material-enabled-select"
                        value={material.enabled ? "true" : "false"}
                        onChange={(event) =>
                          updateMaterial(material.code, { enabled: event.target.value === "true" })
                        }
                      >
                        <option value="true">启用</option>
                        <option value="false">停用</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="input admin-material-number-input"
                        max={15}
                        min={4}
                        type="number"
                        value={material.durationSeconds}
                        onChange={(event) =>
                          updateMaterial(material.code, {
                            durationSeconds: Number(event.target.value)
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input admin-material-number-input"
                        min={0}
                        step={0.01}
                        type="number"
                        value={material.creditsPerSecond}
                        onChange={(event) =>
                          updateMaterial(material.code, {
                            creditsPerSecond: Number(event.target.value)
                          })
                        }
                      />
                    </td>
                    <td>
                      <span className="admin-material-cost-pill">{materialCostLabel(material)}</span>
                    </td>
                    <td>
                      <textarea
                        className="input admin-material-prompt-textarea"
                        value={material.promptContent}
                        onChange={(event) =>
                          updateMaterial(material.code, { promptContent: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <div className="admin-material-row-actions">
                        <button className="button" onClick={() => void saveMaterial(material)}>
                          保存
                        </button>
                        <button
                          className="button danger"
                          type="button"
                          onClick={() => void deleteMaterial(material)}
                        >
                          删除
                        </button>
                        {saveState?.code === material.code ? (
                          <span className={`admin-save-state ${saveState.tone}`}>{saveState.text}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function createEmptyMaterialDraft(groups: MaterialGroup[]): CreateMaterialDraft {
  const defaultGroup = groups.find((group) => group.id === "idleLife") ?? groups[0];

  return {
    code: "",
    name: "",
    groupId: defaultGroup?.id ?? "reserved",
    unlockTier: "custom",
    durationSeconds: 6,
    creditsPerSecond: 1.66,
    promptContent: "",
    enabled: false
  };
}

function materialMutationMessage(error: unknown, fallback: string) {
  if (error === "MATERIAL_CONFIG_ALREADY_EXISTS") {
    return "Code 已存在";
  }

  if (error === "MATERIAL_CONFIG_IN_USE") {
    return "已有猫咪素材引用，不能删除";
  }

  if (error === "MATERIAL_CONFIG_NOT_FOUND") {
    return "素材不存在";
  }

  return typeof error === "string" && error ? error : fallback;
}
