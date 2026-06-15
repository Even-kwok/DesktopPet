"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createActionVideoJob,
  createFrontImageJob,
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
  const [confirmedPetIds, setConfirmedPetIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<StatusMessage>({
    tone: "info",
    text: "选择宠物照片后，可以先生成正面形象，再逐个生成动作视频。"
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
  const isFrontConfirmed = selectedPet ? confirmedPetIds.has(selectedPet.id) : false;

  function setPetPatch(petId: string, patch: Partial<Pet>) {
    setPets((currentPets) =>
      currentPets.map((pet) => (pet.id === petId ? { ...pet, ...patch } : pet))
    );
  }

  function setAssetStatus(petId: string, slot: string, status: PetAssetStatus) {
    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.petId === petId && asset.slot === slot ? { ...asset, status } : asset
      )
    );
  }

  function assetFor(slot: string) {
    return selectedPetAssets.find((asset) => asset.slot === slot);
  }

  function isGeneratingSlot(slot: string) {
    return jobs.some(
      (job) =>
        job.petId === selectedPet?.id &&
        job.slot === slot &&
        (job.status === "queued" || job.status === "running")
    );
  }

  async function pollJob(job: GenerationJob) {
    setJobs((currentJobs) =>
      currentJobs.map((item) =>
        item.jobId === job.jobId ? { ...item, status: "running", progress: 50 } : item
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 800));
    const finishedJob = await getGenerationJob(job.jobId);

    setJobs((currentJobs) =>
      currentJobs.map((item) =>
        item.jobId === job.jobId
          ? { ...item, ...finishedJob, status: finishedJob.status, progress: 100 }
          : item
      )
    );

    return finishedJob;
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
      setPetPatch(selectedPet.id, { sourceImageUrl: previewUrl });
      setMessage({
        tone: "success",
        text:
          upload.mode === "supabase"
            ? `图片已上传到 Supabase：${upload.bucket}/${upload.storagePath}`
            : "图片已进入 mock 上传流程。本地先显示预览，配置 Supabase 后会真正写入 Storage。"
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "图片上传初始化失败。"
      });
    }
  }

  async function handleGenerateFrontImage() {
    if (!selectedPet || !sourcePublicUrl || !sourcePreviewUrl) {
      setMessage({ tone: "error", text: "请先上传一张宠物图片。" });
      return;
    }

    try {
      const job = await createFrontImageJob({
        petId: selectedPet.id,
        sourceImageUrl: sourcePublicUrl
      });
      setJobs((currentJobs) => [job, ...currentJobs]);
      setUser((currentUser) => ({
        ...currentUser,
        credits: Math.max(currentUser.credits - job.cost, 0)
      }));
      setMessage({ tone: "info", text: "正面形象生成任务已创建，正在等待结果。" });

      const finishedJob = await pollJob(job);

      if (finishedJob.status === "succeeded") {
        setPetPatch(selectedPet.id, {
          frontImageUrl: sourcePreviewUrl,
          status: "正面形象待确认"
        });
        setMessage({ tone: "success", text: "正面形象已生成。当前 mock 使用上传图作为预览。" });
      }
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "生成正面形象失败。"
      });
    }
  }

  function handleConfirmFrontImage() {
    if (!selectedPet?.frontImageUrl) {
      setMessage({ tone: "error", text: "请先生成正面形象。" });
      return;
    }

    setConfirmedPetIds((currentIds) => new Set(currentIds).add(selectedPet.id));
    setPetPatch(selectedPet.id, { status: "正面形象已确认" });
    setMessage({ tone: "success", text: "形象已确认，现在可以批量补齐动作素材。" });
  }

  async function handleGenerateAction(slot: MaterialSlot) {
    if (!selectedPet) {
      return;
    }

    if (!isFrontConfirmed) {
      setMessage({ tone: "error", text: "请先确认宠物正面形象，再生成动作视频。" });
      return;
    }

    try {
      setAssetStatus(selectedPet.id, slot.id, "generating");
      const job = await createActionVideoJob({
        petId: selectedPet.id,
        slot: slot.id
      });
      setJobs((currentJobs) => [job, ...currentJobs]);
      setUser((currentUser) => ({
        ...currentUser,
        credits: Math.max(currentUser.credits - job.cost, 0)
      }));
      setMessage({ tone: "info", text: `「${slot.name}」生成任务已创建。` });

      const finishedJob = await pollJob(job);

      if (finishedJob.status === "succeeded") {
        setAssetStatus(selectedPet.id, slot.id, "ready");
        setPetPatch(selectedPet.id, { materialsReady: readyCount + 1 });
        setMessage({ tone: "success", text: `「${slot.name}」已生成，占位素材已加入素材库。` });
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
              <Step number="1" title="上传宠物图片" text="存入 source-images bucket。" />
              <Step number="2" title="生成正面形象" text="调用 GPT Image，用户满意后确认。" />
              <Step number="3" title="生成动作视频" text="按动作卡片逐个调用即梦视频接口。" />
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
                  上传图片
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void handleImageSelected(event.target.files?.[0])}
                  />
                </label>
                <button className="button secondary" onClick={() => void handleGenerateFrontImage()}>
                  生成正面形象
                </button>
                <button className="button ghost" onClick={() => setActiveTab("jobs")}>
                  查看任务队列
                </button>
              </div>
              {selectedFileName ? <p className="small-note">已选择：{selectedFileName}</p> : null}
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
              selectedPet={selectedPet}
              isFrontConfirmed={isFrontConfirmed}
              sourcePreviewUrl={sourcePreviewUrl}
              onConfirmFrontImage={handleConfirmFrontImage}
              assetFor={assetFor}
              isGeneratingSlot={isGeneratingSlot}
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
  selectedPet,
  isFrontConfirmed,
  sourcePreviewUrl,
  onConfirmFrontImage,
  assetFor,
  isGeneratingSlot,
  onGenerateAction
}: {
  slots: MaterialSlot[];
  selectedPet: Pet | undefined;
  isFrontConfirmed: boolean;
  sourcePreviewUrl: string | null;
  onConfirmFrontImage: () => void;
  assetFor: (slot: string) => PetAsset | undefined;
  isGeneratingSlot: (slot: string) => boolean;
  onGenerateAction: (slot: MaterialSlot) => void;
}) {
  return (
    <>
      <section className="panel image-confirm-panel">
        <div>
          <h3>正面形象</h3>
          <p>确认后才能生成动作视频。真实接入后，这里会展示 GPT Image 返回的正面图。</p>
        </div>
        <div className="mini-preview">
          {selectedPet?.frontImageUrl || sourcePreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="正面形象预览" src={selectedPet?.frontImageUrl ?? sourcePreviewUrl ?? ""} />
          ) : (
            <span>🐾</span>
          )}
        </div>
        <button className={isFrontConfirmed ? "button success" : "button"} onClick={onConfirmFrontImage}>
          {isFrontConfirmed ? "形象已确认" : "确认形象"}
        </button>
      </section>

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
                  isGenerating={isGeneratingSlot(slot.id)}
                  isFrontConfirmed={isFrontConfirmed}
                  key={slot.id}
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
  isGenerating,
  isFrontConfirmed,
  onGenerate
}: {
  slot: MaterialSlot;
  asset: PetAsset | undefined;
  isGenerating: boolean;
  isFrontConfirmed: boolean;
  onGenerate: () => void;
}) {
  const status = isGenerating ? "generating" : asset?.status ?? "missing";
  const isReady = status === "ready";

  return (
    <article className={isReady ? "card ready-card" : "card"}>
      <div className="preview">
        <span className="preview-icon">{isGenerating ? "⏳" : slot.icon}</span>
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
        <div className="card-actions">
          <button className="button" disabled={!isFrontConfirmed || isGenerating} onClick={onGenerate}>
            {isGenerating ? "生成中" : `生成 ${slot.cost} 分`}
          </button>
          <button className="button secondary" disabled={!isReady}>
            预览
          </button>
        </div>
      </div>
    </article>
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
      <PanelTitle icon="📦" title="任务队列" subtitle="后续这里会展示真实的 GPT Image / 即梦任务状态。" />
      {jobs.length === 0 ? (
        <div className="empty-state">还没有生成任务。上传图片或点击动作卡片开始。</div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <div className="job-row" key={job.jobId}>
              <div>
                <strong>{job.type === "front_image" ? "正面形象" : job.slot}</strong>
                <p>{job.jobId}</p>
              </div>
              <span className={job.status === "succeeded" ? "badge" : "badge sky"}>{job.status}</span>
              <progress max={100} value={job.progress ?? 0} />
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
