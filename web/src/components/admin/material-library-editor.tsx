"use client";

import { useMemo, useState } from "react";
import { materialCostLabel } from "@/lib/admin-material-table";
import type { MaterialLibraryConfig } from "@/lib/material-library-config";
import type { MaterialGroup } from "@/lib/material-slots";

type SaveState = {
  code: string;
  tone: "saving" | "saved" | "error";
  text: string;
} | null;

export function MaterialLibraryEditor({
  groups,
  initialMaterials
}: {
  groups: MaterialGroup[];
  initialMaterials: MaterialLibraryConfig[];
}) {
  const [materials, setMaterials] = useState(initialMaterials);
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

  return (
    <div className="admin-material-groups">
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
