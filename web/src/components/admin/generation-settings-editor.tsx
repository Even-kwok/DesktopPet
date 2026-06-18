"use client";

import { useState } from "react";
import {
  patchVideoGenerationSettings,
  seedanceVideoModelOptions,
  videoFpsOptions,
  videoRatioOptions,
  videoResolutionOptions,
  type VideoGenerationSettings
} from "@/lib/generation-settings";

type SaveState = {
  tone: "idle" | "saving" | "saved" | "error";
  text: string;
};

export function GenerationSettingsEditor({
  initialSettings
}: {
  initialSettings: VideoGenerationSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saveState, setSaveState] = useState<SaveState>({
    tone: "idle",
    text: "修改后自动保存"
  });

  async function updateSettings(patch: Partial<VideoGenerationSettings>) {
    const nextSettings = patchVideoGenerationSettings(settings, patch);

    setSettings(nextSettings);
    setSaveState({ tone: "saving", text: "保存中" });

    const response = await fetch("/api/admin/generation-settings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(nextSettings)
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setSaveState({
        tone: "error",
        text: payload?.details ?? payload?.error ?? "保存失败"
      });
      return;
    }

    setSettings(payload as VideoGenerationSettings);
    setSaveState({ tone: "saved", text: "已保存" });
  }

  return (
    <div className="admin-generation-settings-editor">
      <div className="admin-generation-settings-head">
        <div>
          <p>
            这里保存全局输出参数；前台用户生成动作素材时，会自动使用这套设置。素材时长和积分仍由素材库每一行单独决定。
          </p>
        </div>
        <span className={`admin-settings-status ${saveState.tone}`}>{saveState.text}</span>
      </div>

      <div className="settings-grid">
        <label className="setting-field">
          <span>模型</span>
          <select
            className="input"
            value={settings.model}
            onChange={(event) =>
              void updateSettings({ model: event.target.value as VideoGenerationSettings["model"] })
            }
          >
            {seedanceVideoModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-field">
          <span>画幅</span>
          <select
            className="input"
            value={settings.ratio}
            onChange={(event) =>
              void updateSettings({ ratio: event.target.value as VideoGenerationSettings["ratio"] })
            }
          >
            {videoRatioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-field">
          <span>清晰度</span>
          <select
            className="input"
            value={settings.resolution}
            onChange={(event) =>
              void updateSettings({
                resolution: event.target.value as VideoGenerationSettings["resolution"]
              })
            }
          >
            {videoResolutionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-field">
          <span>帧率</span>
          <select
            className="input"
            value={settings.framesPerSecond}
            onChange={(event) =>
              void updateSettings({ framesPerSecond: Number(event.target.value) as 24 })
            }
          >
            {videoFpsOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="toggle-grid">
        <Toggle
          checked={settings.generateAudio}
          label="生成声音"
          onChange={(checked) => void updateSettings({ generateAudio: checked })}
        />
        <Toggle
          checked={settings.watermark}
          label="加水印"
          onChange={(checked) => void updateSettings({ watermark: checked })}
        />
        <Toggle
          checked={settings.returnLastFrame}
          label="返回尾帧图"
          onChange={(checked) => void updateSettings({ returnLastFrame: checked })}
        />
      </div>

      <div className="debug-info-grid">
        <div className="debug-note">
          <strong>当前输出</strong>
          <p>格式：MP4。当前模型支持 480p / 720p、24 FPS。后台保存后，后续前台动作生成会直接使用。</p>
        </div>
        <div className="debug-note">
          <strong>模型密钥</strong>
          <p>
            fast 优先读取 ARK_API_KEY / JIMENG_API_KEY；mini 需要账号已开通 API 权限，才会读取 mini_API_KEY。
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-pill">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
