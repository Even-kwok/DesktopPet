"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSlotPrompt,
  defaultVideoGenerationSettings,
  videoFpsOptions,
  videoRatioOptions,
  videoResolutionOptions,
  type VideoGenerationSettings
} from "@/lib/generation-settings";
import {
  createActionVideoJob,
  getGenerationJob,
  recallPet,
  sendHostingRequest,
  updateHostingRequest,
  uploadSourceImage
} from "@/lib/api-client";
import { materialGroups, type MaterialGroup, type MaterialSlot } from "@/lib/material-slots";
import type {
  BackendStatus,
  CurrentUser,
  GenerationJob,
  HostingRequest,
  Pet,
  PetAsset,
  PetAssetStatus,
  StudioBootstrap
} from "@/lib/types";

type StudioTab = "materials" | "pets" | "friends" | "jobs" | "billing";

type MessageTone = "info" | "success" | "error";

type StatusMessage = {
  tone: MessageTone;
  text: string;
};

export function StudioApp({ initialData }: { initialData: StudioBootstrap }) {
  const [user, setUser] = useState<CurrentUser>(initialData.user);
  const [pets, setPets] = useState<Pet[]>(initialData.pets);
  const [assets, setAssets] = useState<PetAsset[]>(initialData.assets);
  const [hostingRequests, setHostingRequests] = useState<HostingRequest[]>(
    initialData.hostingRequests
  );
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedPetId, setSelectedPetId] = useState(initialData.pets[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<StudioTab>("materials");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePublicUrl, setSourcePublicUrl] = useState<string | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    defaultVideoGenerationSettings
  );
  const [promptPreviewSlotId, setPromptPreviewSlotId] = useState(
    initialData.materialSlots[0]?.id ?? ""
  );
  const [message, setMessage] = useState<StatusMessage>({
    tone: "info",
    text: "上传一张绿幕正面坐姿图后，就可以直接作为动作视频的首尾帧。"
  });

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === selectedPetId) ?? pets[0],
    [pets, selectedPetId]
  );

  const selectedPetAssets = useMemo(
    () => assets.filter((asset) => asset.petId === selectedPet?.id),
    [assets, selectedPet?.id]
  );

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  const readyCount = selectedPetAssets.filter((asset) => asset.status === "ready").length;
  const hasFrameImage = selectedPet ? Boolean(selectedPet.frontImageUrl || selectedPet.sourceImageUrl) : false;

  function setPetPatch(petId: string, patch: Partial<Pet>) {
    setPets((currentPets) =>
      currentPets.map((pet) => (pet.id === petId ? { ...pet, ...patch } : pet))
    );
  }

  function setAssetPatch(petId: string, slot: string, patch: Partial<PetAsset>) {
    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.petId === petId && asset.slot === slot ? { ...asset, ...patch } : asset
      )
    );
  }

  function setAssetStatus(petId: string, slot: string, status: PetAssetStatus) {
    setAssetPatch(petId, slot, { status });
  }

  function assetFor(slot: string) {
    return selectedPetAssets.find((asset) => asset.slot === slot);
  }

  function jobForSlot(slot: string) {
    return jobs.find(
      (job) =>
        job.petId === selectedPet?.id &&
        job.slot === slot &&
        (job.status === "queued" || job.status === "running")
    );
  }

  async function pollJob(job: GenerationJob) {
    let latestJob = job;

    for (let attempt = 1; attempt <= 120; attempt += 1) {
      setJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === job.jobId
            ? {
                ...item,
                ...latestJob,
                petId: item.petId,
                slot: item.slot,
                cost: item.cost,
                prompt: item.prompt,
                settings: item.settings,
                sourceImageUrl: item.sourceImageUrl,
                lastImageUrl: item.lastImageUrl,
                createdAt: item.createdAt,
                status: latestJob.status === "queued" ? "running" : latestJob.status,
                progress: estimateJobProgress(item, attempt)
              }
            : item
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 5000));
      latestJob = await getGenerationJob(job.jobId);

      setJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === job.jobId
            ? {
                ...item,
                ...latestJob,
                petId: item.petId,
                slot: item.slot,
                cost: item.cost,
                prompt: item.prompt,
                settings: item.settings,
                sourceImageUrl: item.sourceImageUrl,
                lastImageUrl: item.lastImageUrl,
                createdAt: item.createdAt,
                progress:
                  latestJob.status === "succeeded" ||
                  latestJob.status === "failed" ||
                  latestJob.status === "expired"
                    ? 100
                    : estimateJobProgress(item, attempt)
              }
            : item
        )
      );

      if (
        latestJob.status === "succeeded" ||
        latestJob.status === "failed" ||
        latestJob.status === "expired"
      ) {
        return latestJob;
      }
    }

    return latestJob;
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file || !selectedPet) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(previewUrl);
    setSelectedFileName(file.name);

    try {
      const upload = await uploadSourceImage({
        petId: selectedPet.id,
        file
      });
      setSourcePublicUrl(upload.publicUrl);
      setPetPatch(selectedPet.id, {
        sourceImageUrl: upload.publicUrl,
        frontImageUrl: upload.publicUrl,
        status: "首尾帧形象已就绪"
      });
      setMessage({
        tone: "success",
        text:
          upload.mode === "supabase"
            ? `猫咪形象图已上传：${upload.bucket}/${upload.storagePath}。现在会直接作为首尾帧生成动作视频。`
            : "图片已进入 mock 上传流程。本地先显示预览；配置 Supabase 后会真正写入 Storage。"
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "图片上传初始化失败。"
      });
    }
  }

  async function handleGenerateAction(slot: MaterialSlot) {
    if (!selectedPet) {
      return;
    }

    if (!hasFrameImage) {
      setMessage({ tone: "error", text: "请先上传绿幕正面坐姿图，再生成动作视频。" });
      return;
    }

    try {
      setAssetStatus(selectedPet.id, slot.id, "generating");
      const job = await createActionVideoJob({
        petId: selectedPet.id,
        slot: slot.id,
        sourceImageUrl: selectedPet.frontImageUrl ?? selectedPet.sourceImageUrl ?? sourcePublicUrl ?? undefined,
        lastImageUrl: selectedPet.frontImageUrl ?? selectedPet.sourceImageUrl ?? sourcePublicUrl ?? undefined,
        settings: {
          ...videoSettings,
          durationSeconds: slot.durationSeconds
        }
      });
      setJobs((currentJobs) => [job, ...currentJobs]);
      setUser((currentUser) => ({
        ...currentUser,
        credits: Math.max(currentUser.credits - job.cost, 0)
      }));
      setMessage({ tone: "info", text: `「${slot.name}」生成任务已创建。` });

      const finishedJob = await pollJob(job);

      if (finishedJob.status === "succeeded") {
        setAssetPatch(selectedPet.id, slot.id, {
          status: "ready",
          videoUrl: finishedJob.resultUrl ?? null
        });
        setPetPatch(selectedPet.id, { materialsReady: readyCount + 1 });
        setMessage({
          tone: "success",
          text: finishedJob.resultUrl
            ? `「${slot.name}」已生成，视频地址已返回。`
            : `「${slot.name}」已生成，占位素材已加入素材库。`
        });
      } else if (finishedJob.status === "failed" || finishedJob.status === "expired") {
        setAssetStatus(selectedPet.id, slot.id, "failed");
        setMessage({
          tone: "error",
          text: finishedJob.message ?? `「${slot.name}」生成失败或超时。`
        });
      }
    } catch (error) {
      setAssetStatus(selectedPet.id, slot.id, "failed");
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : `「${slot.name}」生成失败。`
      });
    }
  }

  async function handleSendHosting(friendId: string) {
    if (!selectedPet) {
      return;
    }

    try {
      const response = await sendHostingRequest({
        petId: selectedPet.id,
        toUserId: friendId
      });
      setHostingRequests((currentRequests) => [
        {
          id: response.requestId,
          petName: selectedPet.name,
          from: "你",
          status: "等待好友接收"
        },
        ...currentRequests
      ]);
      setMessage({ tone: "success", text: "托管请求已发送。真实接入后会推送到好友的 Mac App。" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "发送托管请求失败。"
      });
    }
  }

  async function handleHostingAction(request: HostingRequest, action: "accept" | "decline" | "return") {
    try {
      const response = await updateHostingRequest({
        requestId: request.id,
        action
      });
      setHostingRequests((currentRequests) =>
        currentRequests.map((item) =>
          item.id === request.id ? { ...item, status: response.status } : item
        )
      );
      setMessage({ tone: "success", text: "托管状态已更新。" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "托管状态更新失败。"
      });
    }
  }

  async function handleRecallPet() {
    if (!selectedPet) {
      return;
    }

    try {
      const response = await recallPet({ petId: selectedPet.id });
      setPetPatch(selectedPet.id, { status: response.status, host: "me" });
      setMessage({ tone: "success", text: "召回请求已发送。Mac App 同步后会重新显示这只宠物。" });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "召回宠物失败。"
      });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🐱</div>
          <div>
            <h1>DesktopPet Studio</h1>
            <p>网页负责账号、积分、素材生成；Mac App 负责陪伴、播放和托管管理。</p>
            <span className={initialData.backend.mode === "supabase" ? "backend-pill live" : "backend-pill"}>
              {initialData.backend.mode === "supabase" ? "Supabase 已连接" : "Mock 后端"}
            </span>
          </div>
        </div>

        <div className="account-card">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>
          <button className="button secondary">登录 / 注册</button>
        </div>
      </header>

      <div className="layout-grid">
        <aside className="left-rail">
          <PetPanel
            pet={selectedPet}
            pets={pets}
            readyCount={readyCount}
            totalCount={initialData.materialSlots.length}
            credits={user.credits}
            onSelectPet={(petId) => {
              setSelectedPetId(petId);
              setActiveTab("materials");
            }}
          />

          <section className="panel auth-panel">
            <PanelTitle icon="🔐" title="账号入口" subtitle="后续接 Supabase Auth，支持邮箱验证码和第三方登录。" />
            <div className="field-stack">
              <input className="input" placeholder="邮箱 / 手机号" />
              <button className="button">发送登录验证码</button>
            </div>
          </section>

          <BackendPanel backend={initialData.backend} />

          <section className="panel workflow-panel">
            <PanelTitle icon="🪄" title="生成流程" subtitle="每一步都会记录任务、扣积分和保存素材。" />
            <div className="workflow-steps">
              <Step number="1" title="上传绿幕形象图" text="猫咪正面坐姿图，直接存入 source-images。" />
              <Step number="2" title="生成动作视频" text="上传图同时作为 Seedance 首帧和尾帧。" />
              <Step number="3" title="预览和筛选" text="不满意可以调整提示词或参数后重试。" />
              <Step number="4" title="下载素材包" text="Mac App 导入本地播放，云端保留备份。" />
            </div>
          </section>
        </aside>

        <section className="main-board">
          <section className="panel hero-panel">
            <div className="hero-copy">
              <h2>给你的桌宠制作一整套动作素材</h2>
              <p>网页端先做创作工坊，之后接入订阅、积分、生成任务和云端素材库。Mac App 保持轻量，只同步账号和下载素材。</p>
              <div className="hero-actions">
                <label className="button file-button">
                  上传猫咪形象图
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void handleImageSelected(event.target.files?.[0])}
                  />
                </label>
                <button className="button ghost" onClick={() => setActiveTab("jobs")}>
                  查看任务队列
                </button>
              </div>
              {selectedFileName ? <p className="small-note">已选择：{selectedFileName}</p> : null}
              <p className="small-note">
                图片要求：纯绿幕背景，猫咪正面坐着，身体完整，居中清晰，光线均匀；不要裁切耳朵尾巴，不要文字、水印、食盆、玩具或绿色项圈。
              </p>
            </div>
            <div className="credit-pill">
              <span>当前余额</span>
              <strong>{user.credits}</strong>
              <span>积分</span>
            </div>
          </section>

          <StatusBanner message={message} />

          <nav className="tabs" aria-label="Studio sections">
            <TabButton active={activeTab === "materials"} onClick={() => setActiveTab("materials")}>
              动作素材
            </TabButton>
            <TabButton active={activeTab === "pets"} onClick={() => setActiveTab("pets")}>
              我的宠物
            </TabButton>
            <TabButton active={activeTab === "friends"} onClick={() => setActiveTab("friends")}>
              好友托管
            </TabButton>
            <TabButton active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")}>
              任务队列
            </TabButton>
            <TabButton active={activeTab === "billing"} onClick={() => setActiveTab("billing")}>
              账单积分
            </TabButton>
          </nav>

          {activeTab === "materials" ? (
            <MaterialsTab
              slots={initialData.materialSlots}
              hasFrameImage={hasFrameImage}
              videoSettings={videoSettings}
              promptPreviewSlotId={promptPreviewSlotId}
              onPromptPreviewSlotChange={setPromptPreviewSlotId}
              onVideoSettingsChange={setVideoSettings}
              assetFor={assetFor}
              jobForSlot={jobForSlot}
              onGenerateAction={handleGenerateAction}
            />
          ) : null}

          {activeTab === "pets" ? (
            <PetsTab pets={pets} selectedPetId={selectedPet?.id} onSelectPet={setSelectedPetId} onRecallPet={handleRecallPet} />
          ) : null}

          {activeTab === "friends" ? (
            <FriendsTab
              friends={initialData.friends}
              requests={hostingRequests}
              onSendHosting={handleSendHosting}
              onHostingAction={handleHostingAction}
            />
          ) : null}

          {activeTab === "jobs" ? <JobsTab jobs={jobs} /> : null}

          {activeTab === "billing" ? <BillingTab user={user} jobs={jobs} /> : null}
        </section>
      </div>
    </main>
  );
}

function PetPanel({
  pet,
  pets,
  readyCount,
  totalCount,
  credits,
  onSelectPet
}: {
  pet: Pet | undefined;
  pets: Pet[];
  readyCount: number;
  totalCount: number;
  credits: number;
  onSelectPet: (petId: string) => void;
}) {
  return (
    <section className="panel pet-card">
      <div className="pet-stage">
        <div className="pet-portrait">
          {pet?.frontImageUrl || pet?.sourceImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={pet.name} src={pet.frontImageUrl ?? pet.sourceImageUrl ?? ""} />
          ) : (
            "🐈"
          )}
        </div>
      </div>

      <div className="pet-selector">
        {pets.map((item) => (
          <button
            className={item.id === pet?.id ? "pet-chip active" : "pet-chip"}
            key={item.id}
            onClick={() => onSelectPet(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <h2>{pet?.name ?? "未选择宠物"}</h2>
      <p>{pet?.status ?? "选择一只宠物开始制作素材"}，今天心情：{pet?.mood ?? "未知"}</p>

      <div className="stats-grid">
        <div className="stat">
          <strong>{credits}</strong>
          <span>积分</span>
        </div>
        <div className="stat">
          <strong>{readyCount}</strong>
          <span>已完成</span>
        </div>
        <div className="stat">
          <strong>{totalCount}</strong>
          <span>动作位</span>
        </div>
      </div>
    </section>
  );
}

function BackendPanel({ backend }: { backend: BackendStatus }) {
  const isLive = backend.mode === "supabase";

  return (
    <section className="panel backend-panel">
      <PanelTitle
        icon={isLive ? "🟢" : "🧪"}
        title="后端状态"
        subtitle={isLive ? "真实 Supabase 存储已启用。" : "当前使用 mock 数据，不会写入云端。"}
      />
      <div className="backend-grid">
        <div>
          <span>模式</span>
          <strong>{isLive ? "Supabase" : "Mock"}</strong>
        </div>
        <div>
          <span>原图 bucket</span>
          <strong>{backend.sourceImageBucket}</strong>
        </div>
        <div>
          <span>服务端密钥</span>
          <strong>{backend.serviceRoleLooksValid ? "service_role" : backend.serviceRoleRole ?? "未识别"}</strong>
        </div>
      </div>
      {!backend.serviceRoleLooksValid && backend.serviceRoleConfigured ? (
        <p className="backend-warning">SUPABASE_SERVICE_ROLE_KEY 已填写，但不是 service_role key。</p>
      ) : backend.missingEnv.length > 0 ? (
        <p className="backend-warning">待配置：{backend.missingEnv.join(" / ")}</p>
      ) : (
        <p className="backend-ok">环境变量已就绪，可以开始写入 Supabase。</p>
      )}
    </section>
  );
}

function MaterialsTab({
  slots,
  hasFrameImage,
  videoSettings,
  promptPreviewSlotId,
  onPromptPreviewSlotChange,
  onVideoSettingsChange,
  assetFor,
  jobForSlot,
  onGenerateAction
}: {
  slots: MaterialSlot[];
  hasFrameImage: boolean;
  videoSettings: VideoGenerationSettings;
  promptPreviewSlotId: string;
  onPromptPreviewSlotChange: (slotId: string) => void;
  onVideoSettingsChange: (settings: VideoGenerationSettings) => void;
  assetFor: (slot: string) => PetAsset | undefined;
  jobForSlot: (slot: string) => GenerationJob | undefined;
  onGenerateAction: (slot: MaterialSlot) => void;
}) {
  return (
    <>
      <GenerationDebugPanel
        slots={slots}
        settings={videoSettings}
        promptPreviewSlotId={promptPreviewSlotId}
        onPromptPreviewSlotChange={onPromptPreviewSlotChange}
        onSettingsChange={onVideoSettingsChange}
      />

      {materialGroups.map((group) => {
        const groupSlots = slots.filter((slot) => slot.group === group.id);
        const completeCount = groupSlots.filter((slot) => assetFor(slot.id)?.status === "ready").length;

        return (
          <section className="material-section" key={group.id}>
            <div className="section-head">
              <div>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
              </div>
              <span className="badge sky">
                {completeCount}/{groupSlots.length}
              </span>
            </div>

            <div className="materials-grid">
              {groupSlots.map((slot) => (
                <MaterialCard
                  asset={assetFor(slot.id)}
                  activeJob={jobForSlot(slot.id)}
                  hasFrameImage={hasFrameImage}
                  key={slot.id}
                  settings={videoSettings}
                  slot={slot}
                  onGenerate={() => onGenerateAction(slot)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function MaterialCard({
  slot,
  asset,
  activeJob,
  hasFrameImage,
  settings,
  onGenerate
}: {
  slot: MaterialSlot;
  asset: PetAsset | undefined;
  activeJob: GenerationJob | undefined;
  hasFrameImage: boolean;
  settings: VideoGenerationSettings;
  onGenerate: () => void;
}) {
  const isGenerating = Boolean(activeJob);
  const status = isGenerating ? "generating" : asset?.status ?? "missing";
  const isReady = status === "ready";
  const prompt = buildSlotPrompt(slot.id);

  return (
    <article className={isReady ? "card ready-card" : "card"}>
      <div className="preview">
        {asset?.videoUrl ? (
          <video className="preview-video" src={asset.videoUrl} controls loop muted playsInline />
        ) : (
          <span className="preview-icon">{isGenerating ? "⏳" : slot.icon}</span>
        )}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <div>
            <h4>{slot.name}</h4>
            <p>{slot.trigger}</p>
          </div>
          <span className={badgeClassForAsset(status)}>{labelForAsset(status)}</span>
        </div>
        <span className="slot-key">{slot.id}</span>
        {activeJob ? <JobProgress job={activeJob} compact /> : null}
        <details className="prompt-details">
          <summary>查看提示词和参数</summary>
          <div className="prompt-meta">
            <span>{slot.durationSeconds}s</span>
            <span>{settings.resolution}</span>
            <span>{settings.ratio}</span>
            <span>{settings.framesPerSecond} FPS</span>
          </div>
          <pre>{prompt}</pre>
        </details>
        <div className="card-actions">
          <button className="button" disabled={!hasFrameImage || isGenerating} onClick={onGenerate}>
            {isGenerating ? "生成中" : `生成 ${slot.cost} 分`}
          </button>
          <a
            className={isReady && asset?.videoUrl ? "button secondary" : "button secondary disabled-link"}
            href={asset?.videoUrl ?? undefined}
            rel="noreferrer"
            target="_blank"
          >
            预览
          </a>
        </div>
      </div>
    </article>
  );
}

function GenerationDebugPanel({
  slots,
  settings,
  promptPreviewSlotId,
  onPromptPreviewSlotChange,
  onSettingsChange
}: {
  slots: MaterialSlot[];
  settings: VideoGenerationSettings;
  promptPreviewSlotId: string;
  onPromptPreviewSlotChange: (slotId: string) => void;
  onSettingsChange: (settings: VideoGenerationSettings) => void;
}) {
  const previewSlot = slots.find((slot) => slot.id === promptPreviewSlotId) ?? slots[0];
  const prompt = buildSlotPrompt(previewSlot?.id ?? "");

  function patchSettings(patch: Partial<VideoGenerationSettings>) {
    onSettingsChange({ ...settings, ...patch });
  }

  return (
    <section className="panel generation-debug-panel">
      <div className="debug-head">
        <PanelTitle
          icon="🧪"
          title="生成调试面板"
          subtitle="开发阶段先公开显示请求参数和提示词；上线前再按需要折叠。"
        />
        <span className="badge sky">官方无实时百分比，进度为估算</span>
      </div>

      <div className="settings-grid">
        <label className="setting-field">
          <span>画幅</span>
          <select
            className="input"
            value={settings.ratio}
            onChange={(event) =>
              patchSettings({ ratio: event.target.value as VideoGenerationSettings["ratio"] })
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
              patchSettings({ resolution: event.target.value as VideoGenerationSettings["resolution"] })
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
              patchSettings({ framesPerSecond: Number(event.target.value) as 24 })
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
          onChange={(checked) => patchSettings({ generateAudio: checked })}
        />
        <Toggle
          checked={settings.watermark}
          label="加水印"
          onChange={(checked) => patchSettings({ watermark: checked })}
        />
        <Toggle
          checked={settings.returnLastFrame}
          label="返回尾帧图"
          onChange={(checked) => patchSettings({ returnLastFrame: checked })}
        />
      </div>

      <div className="debug-info-grid">
        <div className="debug-note">
          <strong>当前输出</strong>
          <p>格式：MP4。当前模型支持 480p / 720p、24 FPS。时长由每个动作卡片内置，范围固定为 4-15 秒。</p>
        </div>
        <div className="debug-note">
          <strong>首尾帧</strong>
          <p>上传图会同时传给 `first_frame` / `last_frame`。固定镜头通过提示词约束，不发送 `camera_fixed` 字段。</p>
        </div>
      </div>

      <div className="prompt-preview-box">
        <label className="setting-field">
          <span>查看动作提示词</span>
          <select
            className="input"
            value={previewSlot?.id ?? ""}
            onChange={(event) => onPromptPreviewSlotChange(event.target.value)}
          >
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.name} / {slot.id}
              </option>
            ))}
          </select>
        </label>
        <pre>{prompt}</pre>
      </div>
    </section>
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

function PetsTab({
  pets,
  selectedPetId,
  onSelectPet,
  onRecallPet
}: {
  pets: Pet[];
  selectedPetId: string | undefined;
  onSelectPet: (petId: string) => void;
  onRecallPet: () => void;
}) {
  return (
    <section className="panel management-panel">
      <PanelTitle icon="🐾" title="我的宠物" subtitle="网页端管理云端素材，Mac App 后续同步宠物归属和素材包。" />
      <div className="pet-list-grid">
        {pets.map((pet) => (
          <article className={pet.id === selectedPetId ? "pet-list-card active" : "pet-list-card"} key={pet.id}>
            <div className="avatar pet-avatar">{pet.name.slice(0, 1)}</div>
            <div>
              <h4>{pet.name}</h4>
              <p>{pet.status}</p>
            </div>
            <button className="button secondary" onClick={() => onSelectPet(pet.id)}>
              选择
            </button>
            {pet.host === "friend" ? (
              <button className="button" onClick={() => void onRecallPet()}>
                召回
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function FriendsTab({
  friends,
  requests,
  onSendHosting,
  onHostingAction
}: {
  friends: StudioBootstrap["friends"];
  requests: HostingRequest[];
  onSendHosting: (friendId: string) => void;
  onHostingAction: (request: HostingRequest, action: "accept" | "decline" | "return") => void;
}) {
  return (
    <section className="friend-board">
      <div className="panel friend-card">
        <PanelTitle icon="👥" title="好友列表" subtitle="桌面端后续也会有这个列表，用来发起托管。" />
        {friends.map((friend) => (
          <div className="friend-row" key={friend.id}>
            <div>
              <strong>{friend.name}</strong>
              <p>{friend.status} · 托管 {friend.hostedPets} 只</p>
            </div>
            <button className="button secondary" onClick={() => void onSendHosting(friend.id)}>
              请求托管
            </button>
          </div>
        ))}
      </div>

      <div className="panel friend-card">
        <PanelTitle icon="🏠" title="托管状态" subtitle="宠物唯一显示位置由服务器决定，Mac App 只同步和渲染。" />
        {requests.map((request) => (
          <div className="hosting-state" key={request.id}>
            <strong>{request.petName}</strong>
            <p>{request.from} · {request.status}</p>
            <div className="card-actions">
              <button className="button secondary" onClick={() => void onHostingAction(request, "accept")}>
                接收
              </button>
              <button className="button ghost" onClick={() => void onHostingAction(request, "decline")}>
                拒绝
              </button>
              <button className="button secondary" onClick={() => void onHostingAction(request, "return")}>
                送回
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function JobsTab({ jobs }: { jobs: GenerationJob[] }) {
  return (
    <section className="panel management-panel">
      <PanelTitle icon="📦" title="任务队列" subtitle="方舟查询接口只返回阶段状态，百分比是页面估算。" />
      {jobs.length === 0 ? (
        <div className="empty-state">还没有生成任务。上传绿幕形象图或点击动作卡片开始。</div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <div className="job-row" key={job.jobId}>
              <div>
                <strong>{job.type === "front_image" ? "形象图任务" : job.slot}</strong>
                <p>{job.jobId}</p>
              </div>
              <span className={job.status === "succeeded" ? "badge" : "badge sky"}>
                {labelForJobStatus(job.status)}
              </span>
              <JobProgress job={job} />
              {job.settings ? (
                <div className="job-settings">
                  <span>{job.settings.durationSeconds}s</span>
                  <span>{job.settings.resolution}</span>
                  <span>{job.settings.ratio}</span>
                  <span>{job.settings.framesPerSecond} FPS</span>
                  <span>{job.settings.generateAudio ? "有声" : "无声"}</span>
                </div>
              ) : null}
              {job.resultUrl ? (
                <a className="result-link" href={job.resultUrl} rel="noreferrer" target="_blank">
                  打开生成视频
                </a>
              ) : null}
              {job.prompt ? (
                <details className="prompt-details job-prompt">
                  <summary>查看本次提示词</summary>
                  <pre>{job.prompt}</pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BillingTab({ user, jobs }: { user: CurrentUser; jobs: GenerationJob[] }) {
  const spent = jobs.reduce((sum, job) => sum + job.cost, 0);

  return (
    <section className="panel management-panel">
      <PanelTitle icon="💳" title="账单积分" subtitle="第一版先做积分流水，之后接订阅和支付。" />
      <div className="billing-grid">
        <div className="stat large-stat">
          <strong>{user.credits}</strong>
          <span>当前积分</span>
        </div>
        <div className="stat large-stat">
          <strong>{spent}</strong>
          <span>本次 mock 已消耗</span>
        </div>
        <div className="stat large-stat">
          <strong>{jobs.length}</strong>
          <span>生成任务</span>
        </div>
      </div>
    </section>
  );
}

function StatusBanner({ message }: { message: StatusMessage }) {
  return <div className={`status-banner ${message.tone}`}>{message.text}</div>;
}

function JobProgress({ job, compact = false }: { job: GenerationJob; compact?: boolean }) {
  const progress = estimateJobProgress(job);

  return (
    <div className={compact ? "job-progress compact" : "job-progress"}>
      <div className="progress-label-row">
        <span>{labelForJobStatus(job.status)}</span>
        <span>{progress}%</span>
      </div>
      <progress max={100} value={progress} />
      <p>
        已耗时 {formatElapsed(job.createdAt)} · 官方状态 {job.status} · 百分比为页面估算
      </p>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      {children}
    </button>
  );
}

function PanelTitle({
  icon,
  title,
  subtitle
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-title">
      <span className="panel-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  text
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="step">
      <span className="step-number">{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function labelForAsset(status: PetAssetStatus) {
  switch (status) {
    case "ready":
      return "已生成";
    case "queued":
      return "排队中";
    case "generating":
      return "生成中";
    case "failed":
      return "失败";
    case "missing":
      return "待生成";
  }
}

function labelForJobStatus(status: GenerationJob["status"]) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "生成中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "expired":
      return "已超时";
  }
}

function estimateJobProgress(job: GenerationJob, attempt = 0) {
  if (job.status === "succeeded" || job.status === "failed" || job.status === "expired") {
    return 100;
  }

  const startedAt = job.createdAt ? Date.parse(job.createdAt) : NaN;
  const elapsedSeconds = Number.isFinite(startedAt) ? (Date.now() - startedAt) / 1000 : 0;
  const timeBasedProgress =
    job.status === "queued"
      ? Math.min(18, 6 + attempt * 2 + elapsedSeconds / 20)
      : Math.min(94, 24 + attempt * 2 + elapsedSeconds / 4);

  return Math.max(0, Math.round(job.progress ?? timeBasedProgress));
}

function formatElapsed(createdAt: string | undefined) {
  if (!createdAt) {
    return "0:00";
  }

  const startedAt = Date.parse(createdAt);

  if (!Number.isFinite(startedAt)) {
    return "0:00";
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function badgeClassForAsset(status: PetAssetStatus) {
  switch (status) {
    case "ready":
      return "badge";
    case "queued":
    case "generating":
      return "badge sky";
    case "failed":
      return "badge danger";
    case "missing":
      return "badge muted";
  }
}
