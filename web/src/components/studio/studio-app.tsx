"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { buildDesktopPetBundle } from "@/lib/desktop-bundle";
import {
  createActionVideoJob,
  createPet,
  deletePet,
  getGenerationJob,
  getStudioBootstrap,
  publishDesktopPetBundle,
  recallPet,
  savePetMaterial,
  sendHostingRequest,
  updateAccountProfile,
  updateHostingRequest,
  updatePetName,
  uploadSourceImage
} from "@/lib/api-client";
import { reviewGreenScreenImage, type GreenScreenImageMetadata } from "@/lib/green-screen-image-validation";
import {
  GenerationJobPollingError,
  pollGenerationJobUntilTerminal
} from "@/lib/generation-job-polling";
import type { MaterialSlot, MaterialUnlockTier } from "@/lib/material-slots";
import { canDeletePetForAccount } from "@/lib/pet-permissions";
import { formatCnyFromCents } from "@/lib/referral";
import { isReadonlyPet, sortPetsForAccount } from "@/lib/starter-pet";
import {
  accountNameEditControlCopy,
  assetStatusAfterGenerationFailure,
  buildClientPlatformCards,
  buildMaterialWorkflowSteps,
  type ClientPlatformCard,
  jobDisplayName,
  jobGeneratedAtLabel,
  jobGeneratedVideoApplyAction,
  materialCardPreviewState,
  petPanelImageUrl,
  petPanelStats,
  studioStatusMessageClassName
} from "@/lib/studio-layout";
import type {
  CurrentUser,
  GenerationJob,
  HostingRequest,
  Pet,
  PetAsset,
  PetAssetStatus,
  ReferralSummary,
  StudioBootstrap
} from "@/lib/types";

type StudioTab = "materials" | "pets" | "friends" | "jobs" | "billing";

type MessageTone = "info" | "success" | "error";

type StatusMessage = {
  tone: MessageTone;
  text: string;
};

const materialTierSections: Array<{
  id: MaterialUnlockTier;
  title: string;
  description: string;
}> = [
  {
    id: "basic",
    title: "基础版",
    description: "先让小猫稳定住进桌面的核心动作。"
  },
  {
    id: "advanced",
    title: "高级版",
    description: "补上情绪、待机和互动，小猫会更有性格。"
  },
  {
    id: "custom",
    title: "自定义",
    description: "按活动、角色或单独需求解锁的小动作。"
  }
];

const macClientDownloadUrl = process.env.NEXT_PUBLIC_MAC_CLIENT_DOWNLOAD_URL?.trim() || null;
const clientPlatformCards = buildClientPlatformCards(macClientDownloadUrl);

export function StudioApp({ initialData }: { initialData: StudioBootstrap }) {
  const [user, setUser] = useState<CurrentUser>(initialData.user);
  const [pets, setPets] = useState<Pet[]>(initialData.pets);
  const [assets, setAssets] = useState<PetAsset[]>(initialData.assets);
  const [hostingRequests, setHostingRequests] = useState<HostingRequest[]>(
    initialData.hostingRequests
  );
  const [jobs, setJobs] = useState<GenerationJob[]>(initialData.jobs);
  const [selectedPetId, setSelectedPetId] = useState(initialData.pets[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<StudioTab>("materials");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePublicUrl, setSourcePublicUrl] = useState<string | null>(null);
  const [isCreatingPet, setIsCreatingPet] = useState(false);
  const [pendingDeletePetId, setPendingDeletePetId] = useState<string | null>(null);
  const [deletingPetId, setDeletingPetId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState(initialData.user.name);
  const [submittingSlotKeys, setSubmittingSlotKeys] = useState<Set<string>>(() => new Set());
  const [applyingJobIds, setApplyingJobIds] = useState<Set<string>>(() => new Set());
  const [generationErrorsBySlot, setGenerationErrorsBySlot] = useState<Record<string, string>>({});
  const submittingSlotKeysRef = useRef(new Set<string>());
  const [message, setMessage] = useState<StatusMessage>({
    tone: "info",
    text: "上传一张绿幕猫咪图，就可以开始生成会动的小状态。"
  });

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === selectedPetId) ?? pets[0],
    [pets, selectedPetId]
  );

  const pendingDeletePet = useMemo(
    () => pets.find((pet) => pet.id === pendingDeletePetId) ?? null,
    [pendingDeletePetId, pets]
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

  useEffect(() => {
    if (!isEditingProfile) {
      setProfileNameDraft(user.name);
    }
  }, [isEditingProfile, user.name]);

  useEffect(() => {
    const activeJobs = initialData.jobs.filter(
      (job) => job.status === "queued" || job.status === "running"
    );

    activeJobs.forEach((job) => {
      void pollJob(job)
        .then(finishGenerationJob)
        .catch((error: unknown) => {
          const errorText = error instanceof Error ? error.message : "恢复生成记录失败。";

          if (error instanceof GenerationJobPollingError) {
            setMessage({
              tone: "error",
              text: `生成状态查询暂时中断，任务可能仍在继续：${errorText}`
            });
            return;
          }

          if (job.slot) {
            setSlotGenerationError(job.petId, job.slot, errorText);
            setAssetStatus(job.petId, job.slot, "failed");
          }
          setMessage({
            tone: "error",
            text: errorText
          });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readyCount = selectedPetAssets.filter((asset) => asset.status === "ready").length;
  const hasFrameImage = selectedPet ? Boolean(selectedPet.frontImageUrl || selectedPet.sourceImageUrl) : false;
  const selectedPetIsReadonly = selectedPet ? isReadonlyPet(selectedPet) : false;
  const accountEditControlCopy = accountNameEditControlCopy(user.name);

  function setPetPatch(petId: string, patch: Partial<Pet>) {
    setPets((currentPets) =>
      currentPets.map((pet) => (pet.id === petId ? { ...pet, ...patch } : pet))
    );
  }

  function setAssetStatus(petId: string, slot: string, status: PetAssetStatus) {
    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.petId === petId && asset.slot === slot
          ? {
              ...asset,
              status: status === "failed" ? assetStatusAfterGenerationFailure(asset) : status
            }
          : asset
      )
    );
  }

  function assetsWithSavedAsset(currentAssets: PetAsset[], savedAsset: PetAsset) {
    const index = currentAssets.findIndex(
      (asset) => asset.petId === savedAsset.petId && asset.slot === savedAsset.slot
    );

    if (index < 0) {
      return [...currentAssets, savedAsset];
    }

    return currentAssets.map((asset, assetIndex) =>
      assetIndex === index ? savedAsset : asset
    );
  }

  function petsWithReadyCounts(currentPets: Pet[], nextAssets: PetAsset[]) {
    return currentPets.map((pet) => ({
      ...pet,
      materialsReady: nextAssets.filter(
        (asset) => asset.petId === pet.id && asset.status === "ready"
      ).length
    }));
  }

  function setSlotGenerationError(petId: string, slot: string, message: string | null) {
    const key = generationSlotKey(petId, slot);

    setGenerationErrorsBySlot((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (message) {
        nextErrors[key] = message;
      } else {
        delete nextErrors[key];
      }

      return nextErrors;
    });
  }

  function retireLocalActiveJobsForPetSourceChange(petId: string) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.petId === petId &&
        job.type === "action_video" &&
        (job.status === "queued" || job.status === "running")
          ? {
              ...job,
              status: "expired",
              progress: 100,
              message: "绿幕形象已更新，这次生成先停下。"
            }
          : job
      )
    );
    setAssets((currentAssets) =>
      currentAssets.map((asset) =>
        asset.petId === petId &&
        !asset.videoUrl &&
        (asset.status === "queued" || asset.status === "generating")
          ? {
              ...asset,
              status: "failed"
            }
          : asset
      )
    );
  }

  function assetFor(slot: string) {
    return selectedPetAssets.find((asset) => asset.slot === slot);
  }

  function generationErrorForSlot(slot: string) {
    return selectedPet ? generationErrorsBySlot[generationSlotKey(selectedPet.id, slot)] : undefined;
  }

  async function publishDesktopSyncBundle(nextPets: Pet[], nextAssets: PetAsset[]) {
    return publishDesktopPetBundle(
      buildDesktopPetBundle({
        account: user,
        backendMode: initialData.backend.mode,
        pets: nextPets,
        assets: nextAssets
      })
    );
  }

  async function publishDesktopSyncBundleForBootstrap(data: StudioBootstrap) {
    return publishDesktopPetBundle(
      buildDesktopPetBundle({
        account: data.user,
        backendMode: data.backend.mode,
        pets: data.pets,
        assets: data.assets
      })
    );
  }

  async function publishDesktopSyncBundleForAccount(account: CurrentUser) {
    return publishDesktopPetBundle(
      buildDesktopPetBundle({
        account,
        backendMode: initialData.backend.mode,
        pets,
        assets
      })
    );
  }

  async function refreshStudioData() {
    const data = await getStudioBootstrap();

    setUser(data.user);
    setPets(data.pets);
    setAssets(data.assets);
    setHostingRequests(data.hostingRequests);
    setJobs(data.jobs);

    if (!data.pets.some((pet) => pet.id === selectedPetId)) {
      setSelectedPetId(data.pets[0]?.id ?? "");
    }

    return data;
  }

  function jobForSlot(slot: string) {
    return jobs.find(
      (job) =>
        job.petId === selectedPet?.id &&
        job.slot === slot &&
        (job.status === "queued" || job.status === "running")
    );
  }

  function generationSlotKey(petId: string, slot: string) {
    return `${petId}:${slot}`;
  }

  function isSubmittingSlot(slot: string) {
    return selectedPet ? submittingSlotKeys.has(generationSlotKey(selectedPet.id, slot)) : false;
  }

  function setSlotSubmitting(petId: string, slot: string, isSubmitting: boolean) {
    const key = generationSlotKey(petId, slot);

    if (isSubmitting) {
      submittingSlotKeysRef.current.add(key);
    } else {
      submittingSlotKeysRef.current.delete(key);
    }

    setSubmittingSlotKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (isSubmitting) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }

      return nextKeys;
    });
  }

  function setJobApplying(jobId: string, isApplying: boolean) {
    setApplyingJobIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (isApplying) {
        nextIds.add(jobId);
      } else {
        nextIds.delete(jobId);
      }

      return nextIds;
    });
  }

  async function pollJob(job: GenerationJob) {
    return pollGenerationJobUntilTerminal({
      job,
      fetchJob: getGenerationJob,
      onProgress: (latestJob, attempt) => {
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
      },
      onStatusError: () => {
        setMessage({
          tone: "info",
          text: "生成状态查询短暂失败，正在继续重试。"
        });
      }
    });
  }

  async function finishGenerationJob(job: GenerationJob) {
    const slot = initialData.materialSlots.find((item) => item.id === job.slot);

    if (job.status === "succeeded") {
      if (!job.resultUrl) {
        if (job.slot) {
          setSlotGenerationError(job.petId, job.slot, "动作做好了，但还没拿到视频。");
          setAssetStatus(job.petId, job.slot, "missing");
        }
        setMessage({
          tone: "error",
          text: `「${slot?.name ?? job.slot ?? "素材"}」动作做好了，但还没拿到视频，先没有放进动作包。`
        });
        return;
      }

      const refreshedData = await refreshStudioData();
      if (job.slot) {
        setSlotGenerationError(job.petId, job.slot, null);
      }
      let desktopPublishMessage = "";

      try {
        const publishResult = await publishDesktopSyncBundleForBootstrap(refreshedData);
        desktopPublishMessage =
          publishResult.mode === "supabase" ? "Mac 端的小窝已备好。" : "预览小窝已更新。";
      } catch (error) {
        desktopPublishMessage =
          error instanceof Error ? `同步到 Mac 端失败：${error.message}` : "同步到 Mac 端失败。";
      }

      setMessage({
        tone: desktopPublishMessage.includes("失败") ? "error" : "success",
        text: `「${slot?.name ?? job.slot ?? "素材"}」已做好，动作已放进素材库。${desktopPublishMessage}`
      });
    } else if (job.status === "failed" || job.status === "expired") {
      const errorText = job.message ?? `「${slot?.name ?? job.slot ?? "素材"}」生成失败或超时。`;

      if (job.slot) {
        setSlotGenerationError(job.petId, job.slot, errorText);
        setAssetStatus(job.petId, job.slot, "failed");
      }
      setMessage({
        tone: "error",
        text: errorText
      });
    }
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file || !selectedPet) {
      return;
    }

    if (isReadonlyPet(selectedPet)) {
      setMessage({ tone: "info", text: "体验猫不能更换形象图，可以添加新的猫咪后上传。" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(previewUrl);
    setSelectedFileName(file.name);

    try {
      const imageReview = reviewGreenScreenImage(await inspectGreenScreenImage(file));

      if (!imageReview.canUse) {
        setMessage({
          tone: "error",
          text: imageReview.errors.join(" ")
        });
        return;
      }

      const upload = await uploadSourceImage({
        petId: selectedPet.id,
        file
      });
      const nextPets = pets.map((pet) =>
        pet.id === selectedPet.id
          ? upload.pet ?? {
              ...pet,
              sourceImageUrl: upload.publicUrl,
              frontImageUrl: upload.publicUrl,
              status: "绿幕形象已就绪"
            }
          : pet
      );

      setSourcePublicUrl(upload.publicUrl);
      setPets(nextPets);
      retireLocalActiveJobsForPetSourceChange(selectedPet.id);
      void publishDesktopSyncBundle(nextPets, assets).catch((error) => {
        console.warn("Desktop bundle publish after image upload failed", error);
      });
      setMessage({
        tone: imageReview.warnings.length > 0 ? "info" : "success",
        text:
          (upload.mode === "supabase"
            ? "绿幕猫咪图已保存，接下来可以生成动作啦。"
            : "绿幕猫咪图已放进预览小窝，接下来可以生成动作啦。") +
          (imageReview.warnings.length > 0 ? ` ${imageReview.warnings.join(" ")}` : "")
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

    if (isReadonlyPet(selectedPet)) {
      setMessage({ tone: "info", text: "体验猫的素材不能重新生成，可以添加新的猫咪后编辑。" });
      return;
    }

    if (!hasFrameImage) {
      setMessage({ tone: "error", text: "请先上传绿幕正面坐姿图，再生成动作视频。" });
      return;
    }

    const slotKey = generationSlotKey(selectedPet.id, slot.id);
    const activeJob = jobForSlot(slot.id);

    if (submittingSlotKeysRef.current.has(slotKey) || activeJob) {
      setMessage({ tone: "info", text: `「${slot.name}」正在制作中，稍等它一下。` });
      return;
    }

    try {
      setSlotSubmitting(selectedPet.id, slot.id, true);
      setSlotGenerationError(selectedPet.id, slot.id, null);
      setAssetStatus(selectedPet.id, slot.id, "generating");
      const job = await createActionVideoJob({
        petId: selectedPet.id,
        slot: slot.id,
        sourceImageUrl: selectedPet.frontImageUrl ?? selectedPet.sourceImageUrl ?? sourcePublicUrl ?? undefined,
        lastImageUrl: selectedPet.frontImageUrl ?? selectedPet.sourceImageUrl ?? sourcePublicUrl ?? undefined
      });
      const isAlreadyTracked = jobs.some((item) => item.jobId === job.jobId);

      setJobs((currentJobs) =>
        currentJobs.some((item) => item.jobId === job.jobId) ? currentJobs : [job, ...currentJobs]
      );
      setSlotSubmitting(selectedPet.id, slot.id, false);

      if (!isAlreadyTracked) {
        setUser((currentUser) => ({
          ...currentUser,
          credits: Math.max(currentUser.credits - job.cost, 0)
        }));
      }

      setMessage({ tone: "info", text: `开始给「${slot.name}」做动作了。` });

      const finishedJob = await pollJob(job);
      await finishGenerationJob(finishedJob);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : `「${slot.name}」生成失败。`;

      if (error instanceof GenerationJobPollingError) {
        setMessage({
          tone: "error",
          text: `「${slot.name}」状态查询暂时中断，任务可能仍在继续；刷新页面会自动恢复。`
        });
        return;
      }

      setSlotGenerationError(selectedPet.id, slot.id, errorText);
      setAssetStatus(selectedPet.id, slot.id, "failed");
      setMessage({
        tone: "error",
        text: errorText
      });
    } finally {
      setSlotSubmitting(selectedPet.id, slot.id, false);
    }
  }

  async function handleApplyGeneratedVideo(job: GenerationJob) {
    if (job.type !== "action_video" || !job.slot || !job.resultUrl) {
      return;
    }

    const pet = pets.find((item) => item.id === job.petId);
    const slot = initialData.materialSlots.find((item) => item.id === job.slot);

    if (!pet) {
      setMessage({ tone: "error", text: "原猫咪已删除，无法应用到动作包。" });
      return;
    }

    if (isReadonlyPet(pet)) {
      setMessage({ tone: "info", text: "体验猫的素材不能被覆盖，可以添加新的猫咪后编辑。" });
      return;
    }

    setJobApplying(job.jobId, true);
    setMessage({ tone: "info", text: `正在把「${slot?.name ?? job.slot}」应用到「${pet.name}」的动作包。` });

    try {
      const response = await savePetMaterial({
        petId: job.petId,
        slot: job.slot,
        videoUrl: job.resultUrl
      });
      const nextAssets = assetsWithSavedAsset(assets, response.asset);
      const nextPets = petsWithReadyCounts(pets, nextAssets);

      setAssets(nextAssets);
      setPets(nextPets);

      let desktopPublishMessage = "";
      try {
        const publishResult = await publishDesktopSyncBundle(nextPets, nextAssets);
        desktopPublishMessage =
          publishResult.mode === "supabase" ? "Mac 端的小窝已备好。" : "预览小窝已更新。";
      } catch (error) {
        desktopPublishMessage =
          error instanceof Error ? `同步到 Mac 端失败：${error.message}` : "同步到 Mac 端失败。";
      }

      setMessage({
        tone: desktopPublishMessage.includes("失败") ? "error" : "success",
        text: `已把这段动作收进「${pet.name}」的「${slot?.name ?? job.slot}」。${desktopPublishMessage}`
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "这段动作暂时放不进去。"
      });
    } finally {
      setJobApplying(job.jobId, false);
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
      setMessage({ tone: "success", text: "托管请求已送出，好友同步后就能看到。" });
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

  function handleRequestDeletePet(pet: Pet) {
    if (deletingPetId) {
      return;
    }

    setPendingDeletePetId(pet.id);
  }

  function handleCancelDeletePet() {
    if (deletingPetId) {
      return;
    }

    setPendingDeletePetId(null);
    setMessage({ tone: "info", text: "已取消删除。" });
  }

  async function handleConfirmDeletePet() {
    if (!pendingDeletePet || deletingPetId) {
      return;
    }

    const pet = pendingDeletePet;
    setDeletingPetId(pet.id);
    setMessage({ tone: "info", text: `正在删除「${pet.name}」...` });

    try {
      const result = await deletePet({
        petId: pet.id,
        confirmation: "永久删除"
      });
      const nextPets = pets.filter((item) => item.id !== result.deletedPetId);
      const nextAssets = assets.filter((asset) => asset.petId !== result.deletedPetId);

      setPets(nextPets);
      setAssets(nextAssets);
      setPendingDeletePetId(null);
      setSelectedPetId((currentPetId) =>
        currentPetId === result.deletedPetId ? nextPets[0]?.id ?? "" : currentPetId
      );
      setMessage({
        tone: "success",
        text: `已删除「${pet.name}」和 ${result.deletedAssets} 个素材记录。`
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "删除猫咪失败。";

      if (errorText.startsWith("PET_NOT_FOUND")) {
        setPendingDeletePetId(null);

        try {
          await refreshStudioData();
          setMessage({ tone: "info", text: "这只猫咪已经不在账号里，列表已刷新。" });
        } catch (refreshError) {
          setMessage({
            tone: "error",
            text:
              refreshError instanceof Error
                ? `没有找到可删除的猫咪，刷新列表也失败了：${refreshError.message}`
                : "没有找到可删除的猫咪，刷新列表也失败了。"
          });
        }

        return;
      }

      setMessage({
        tone: "error",
        text: errorText
      });
    } finally {
      setDeletingPetId(null);
    }
  }

  function handleSelectPet(petId: string) {
    setSelectedPetId(petId);
    setSourcePreviewUrl(null);
    setSelectedFileName("");
    setSourcePublicUrl(null);
  }

  async function handleCreatePet() {
    if (isCreatingPet) {
      return;
    }

    setIsCreatingPet(true);
    setMessage({ tone: "info", text: "正在添加新猫咪..." });

    try {
      const response = await createPet();
      const nextPets = sortPetsForAccount([...pets, response.pet]);

      setPets(nextPets);
      handleSelectPet(response.pet.id);
      setActiveTab("materials");
      setMessage({ tone: "success", text: `已添加「${response.pet.name}」，可以上传猫咪形象图。` });
      void publishDesktopSyncBundle(nextPets, assets).catch((error) => {
        console.warn("Desktop bundle publish after pet create failed", error);
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "添加宠物失败。"
      });
    } finally {
      setIsCreatingPet(false);
    }
  }

  async function handleRenamePet(petId: string, name: string) {
    try {
      const response = await updatePetName({ petId, name });
      const nextPets = pets.map((pet) => (pet.id === response.pet.id ? response.pet : pet));

      setPets(nextPets);
      setMessage({ tone: "success", text: `已将猫咪改名为「${response.pet.name}」。` });
      void publishDesktopSyncBundle(nextPets, assets).catch((error) => {
        console.warn("Desktop bundle publish after pet rename failed", error);
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "猫咪改名失败。"
      });
      throw error;
    }
  }

  async function handleProfileNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = profileNameDraft.trim();

    if (!nextName) {
      setMessage({ tone: "error", text: "账号名称不能为空。" });
      return;
    }

    if (nextName === user.name) {
      setIsEditingProfile(false);
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await updateAccountProfile({ name: nextName });

      setUser(response.user);
      setProfileNameDraft(response.user.name);
      setIsEditingProfile(false);
      setMessage({ tone: "success", text: "账号名称已更新。" });
      void publishDesktopSyncBundleForAccount(response.user).catch((error) => {
        console.warn("Desktop bundle publish after profile update failed", error);
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "账号名称更新失败。"
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🐱</div>
          <div>
            <h1>DesktopPet Studio</h1>
          </div>
        </div>

        <div className="account-card">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div className="account-identity">
            {isEditingProfile ? (
              <form className="profile-name-form" onSubmit={(event) => void handleProfileNameSubmit(event)}>
                <input
                  aria-label="账号名称"
                  className="input profile-name-input"
                  maxLength={30}
                  value={profileNameDraft}
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                />
                <button className="button tiny" disabled={isSavingProfile} type="submit">
                  {isSavingProfile ? "保存中" : "保存"}
                </button>
                <button
                  className="button ghost tiny"
                  disabled={isSavingProfile}
                  type="button"
                  onClick={() => {
                    setProfileNameDraft(user.name);
                    setIsEditingProfile(false);
                  }}
                >
                  取消
                </button>
              </form>
            ) : (
              <div className="account-name-row">
                <strong>{user.name}</strong>
                <button
                  aria-label={accountEditControlCopy.ariaLabel}
                  className={`${accountEditControlCopy.className} account-edit-button`}
                  title={accountEditControlCopy.ariaLabel}
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                >
                  <span aria-hidden="true">{accountEditControlCopy.icon}</span>
                </button>
              </div>
            )}
            <p>{user.email}</p>
          </div>
          <div className="account-credits" aria-label={`积分余额 ${user.credits}`}>
            <span>积分</span>
            <strong>{user.credits}</strong>
          </div>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="next" value="/" />
            <button className="button secondary" type="submit">
              退出
            </button>
          </form>
        </div>
      </header>

      <ClientCenter cards={clientPlatformCards} />

      <p
        className={studioStatusMessageClassName(message.tone)}
        role={message.tone === "error" ? "alert" : "status"}
      >
        {message.text}
      </p>

      <div className="layout-grid">
        <aside className="left-rail">
          <PetPanel
            pet={selectedPet}
            pets={pets}
            readyCount={readyCount}
            selectedFileName={selectedFileName}
            sourcePreviewUrl={sourcePreviewUrl}
            isCreatingPet={isCreatingPet}
            isReadonly={selectedPetIsReadonly}
            onSelectPet={(petId) => {
              handleSelectPet(petId);
              setActiveTab("materials");
            }}
            onCreatePet={handleCreatePet}
            onImageSelected={handleImageSelected}
          />
        </aside>

        <section className="main-board">
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
              生成记录
            </TabButton>
            <TabButton active={activeTab === "billing"} onClick={() => setActiveTab("billing")}>
              账单积分
            </TabButton>
          </nav>

          {activeTab === "materials" ? (
            <MaterialsTab
              slots={initialData.materialSlots}
              hasFrameImage={hasFrameImage}
              canEditMaterials={!selectedPetIsReadonly}
              assetFor={assetFor}
              generationErrorForSlot={generationErrorForSlot}
              isSubmittingAction={isSubmittingSlot}
              jobForSlot={jobForSlot}
              onGenerateAction={handleGenerateAction}
            />
          ) : null}

          {activeTab === "pets" ? (
            <PetsTab
              currentUser={user}
              deletingPetId={deletingPetId}
              pets={pets}
              selectedPetId={selectedPet?.id}
              onDeletePet={handleRequestDeletePet}
              onRenamePet={handleRenamePet}
              onRecallPet={handleRecallPet}
            />
          ) : null}

          {activeTab === "friends" ? (
            <FriendsTab
              friends={initialData.friends}
              requests={hostingRequests}
              onSendHosting={handleSendHosting}
              onHostingAction={handleHostingAction}
            />
          ) : null}

          {activeTab === "jobs" ? (
            <JobsTab
              applyingJobIds={applyingJobIds}
              jobs={jobs}
              pets={pets}
              slots={initialData.materialSlots}
              onApplyGeneratedVideo={handleApplyGeneratedVideo}
            />
          ) : null}

          {activeTab === "billing" ? (
            <BillingTab
              user={user}
              jobs={jobs}
              referralSummary={initialData.referralSummary}
            />
          ) : null}
        </section>
      </div>

      <DeletePetDialog
        isDeleting={deletingPetId === pendingDeletePet?.id}
        pet={pendingDeletePet}
        onCancel={handleCancelDeletePet}
        onConfirm={handleConfirmDeletePet}
      />
    </main>
  );
}

async function inspectGreenScreenImage(file: File): Promise<GreenScreenImageMetadata> {
  const image = await loadImageForInspection(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("图片检查失败，请换一张绿幕图试试。");
  }

  context.drawImage(image, 0, 0);

  return {
    contentType: file.type,
    sizeBytes: file.size,
    width: image.naturalWidth,
    height: image.naturalHeight,
    greenEdgeRatio: calculateGreenEdgeRatio(context, image.naturalWidth, image.naturalHeight)
  };
}

function loadImageForInspection(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片打不开，请换一张绿幕图试试。"));
    };
    image.src = url;
  });
}

function calculateGreenEdgeRatio(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 40));
  const edgeDepth = Math.max(4, Math.floor(Math.min(width, height) * 0.12));
  let greenPixels = 0;
  let sampledPixels = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const isEdge =
        x < edgeDepth || y < edgeDepth || x > width - edgeDepth || y > height - edgeDepth;

      if (!isEdge) {
        continue;
      }

      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      sampledPixels += 1;

      if (green > 110 && green > red * 1.25 && green > blue * 1.25) {
        greenPixels += 1;
      }
    }
  }

  return sampledPixels === 0 ? 0 : greenPixels / sampledPixels;
}

function ClientCenter({ cards }: { cards: ClientPlatformCard[] }) {
  return (
    <section className="panel client-center" aria-label="客户端下载中心">
      <div className="client-center-copy">
        <span className="eyebrow">客户端中心</span>
        <h2>把生成好的宠物同步到你的设备</h2>
        <p>先生成基础动作，再下载安装到设备上。Mac 端优先准备，Windows 和手机端入口先预留。</p>
      </div>
      <div className="client-platform-grid">
        {cards.map((card) => (
          <article
            className={[
              "client-platform-card",
              card.id === "mac" ? "priority" : "",
              card.isEnabled ? "enabled" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={card.id}
          >
            <span className={card.id === "mac" || card.isEnabled ? "badge success" : "badge muted"}>
              {card.statusLabel}
            </span>
            <div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
            <ClientAction card={card} />
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientAction({ card }: { card: ClientPlatformCard }) {
  if (card.isEnabled && card.actionUrl) {
    return (
      <a className="button client-action" href={card.actionUrl}>
        {card.actionLabel}
      </a>
    );
  }

  return (
    <button className="button secondary client-action" disabled type="button">
      {card.actionLabel}
    </button>
  );
}

function PetPanel({
  pet,
  pets,
  readyCount,
  selectedFileName,
  sourcePreviewUrl,
  isCreatingPet,
  isReadonly,
  onSelectPet,
  onCreatePet,
  onImageSelected
}: {
  pet: Pet | undefined;
  pets: Pet[];
  readyCount: number;
  selectedFileName: string;
  sourcePreviewUrl: string | null;
  isCreatingPet: boolean;
  isReadonly: boolean;
  onSelectPet: (petId: string) => void;
  onCreatePet: () => void;
  onImageSelected: (file: File | undefined) => void;
}) {
  const imageUrl = petPanelImageUrl(pet, sourcePreviewUrl);
  petPanelStats({ readyCount });

  return (
    <section className="panel pet-card">
      <div className="pet-stage">
        <div className="pet-portrait">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={pet?.name ?? "猫咪形象图"} src={imageUrl} />
          ) : (
            "🐈"
          )}
        </div>
      </div>

      <div className="pet-summary">
        <div>
          <span className="eyebrow">当前宠物</span>
          <h2>{pet?.name ?? "未选择宠物"}</h2>
          <p>{pet?.status ?? "添加一只宠物后开始生成动作。"}</p>
        </div>
        <div className="pet-ready-stat" aria-label={`已完成素材 ${readyCount}`}>
          <strong>{readyCount}</strong>
          <span>已完成</span>
        </div>
      </div>

      <div className="pet-upload-block">
        <label className={isReadonly ? "button file-button pet-upload-button disabled" : "button file-button pet-upload-button"}>
          {isReadonly ? "体验猫不可编辑" : "上传猫咪形象图"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={isReadonly}
            onChange={(event) => void onImageSelected(event.target.files?.[0])}
          />
        </label>
        {selectedFileName ? <p className="small-note">已选择：{selectedFileName}</p> : null}
        <p className="small-note">要求：纯绿幕背景，正面坐姿，身体完整清晰。</p>
      </div>

      <div className="pet-selector">
        {pets.map((item) => {
          const isSelectedPet = item.id === pet?.id;

          return (
            <button
              className={isSelectedPet ? "pet-chip active" : "pet-chip"}
              key={item.id}
              onClick={() => onSelectPet(item.id)}
            >
              {item.name}
            </button>
          );
        })}
        <button
          aria-label="添加宠物"
          className="pet-chip pet-add-chip"
          disabled={isCreatingPet}
          title="添加宠物"
          onClick={onCreatePet}
        >
          {isCreatingPet ? "..." : "+"}
        </button>
      </div>
    </section>
  );
}

function MaterialsTab({
  slots,
  hasFrameImage,
  canEditMaterials,
  assetFor,
  generationErrorForSlot,
  isSubmittingAction,
  jobForSlot,
  onGenerateAction
}: {
  slots: MaterialSlot[];
  hasFrameImage: boolean;
  canEditMaterials: boolean;
  assetFor: (slot: string) => PetAsset | undefined;
  generationErrorForSlot: (slot: string) => string | undefined;
  isSubmittingAction: (slot: string) => boolean;
  jobForSlot: (slot: string) => GenerationJob | undefined;
  onGenerateAction: (slot: MaterialSlot) => void;
}) {
  const basicSlots = slots.filter((slot) => slot.unlockTier === "basic");
  const basicReadyCount = basicSlots.filter((slot) => assetFor(slot.id)?.status === "ready").length;
  const totalReadyCount = slots.filter((slot) => assetFor(slot.id)?.status === "ready").length;

  return (
    <>
      <StarterSteps
        basicReadyCount={basicReadyCount}
        basicTotalCount={basicSlots.length}
        hasFrameImage={hasFrameImage}
        totalReadyCount={totalReadyCount}
      />

      {materialTierSections.map((section) => {
        const tierSlots = slots.filter((slot) => slot.unlockTier === section.id);
        const completeCount = tierSlots.filter((slot) => assetFor(slot.id)?.status === "ready").length;

        if (tierSlots.length === 0) {
          return null;
        }

        return (
          <section className="material-section" key={section.id}>
            <div className="section-head">
              <div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
              <span className="badge sky">
                {completeCount}/{tierSlots.length}
              </span>
            </div>

            <div className="materials-grid">
              {tierSlots.map((slot) => (
                <MaterialCard
                  asset={assetFor(slot.id)}
                  activeJob={jobForSlot(slot.id)}
                  canEdit={canEditMaterials}
                  generationError={generationErrorForSlot(slot.id)}
                  hasFrameImage={hasFrameImage}
                  isSubmitting={isSubmittingAction(slot.id)}
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

function StarterSteps({
  basicReadyCount,
  basicTotalCount,
  hasFrameImage,
  totalReadyCount
}: {
  basicReadyCount: number;
  basicTotalCount: number;
  hasFrameImage: boolean;
  totalReadyCount: number;
}) {
  const steps = buildMaterialWorkflowSteps({
    basicReadyCount,
    basicTotalCount,
    hasFrameImage,
    hasMacDownload: Boolean(macClientDownloadUrl),
    totalReadyCount
  });

  return (
    <section className="starter-strip" aria-label="生成路线">
      <div>
        <h3>生成路线</h3>
        <p>先跑通基础动作，再下载安装到桌面端同步。</p>
      </div>
      <div className="starter-steps">
        {steps.map((step, index) => (
          <div className="starter-step" key={step.title}>
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
            <em>{step.state}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function MaterialCard({
  slot,
  asset,
  activeJob,
  canEdit,
  generationError,
  hasFrameImage,
  isSubmitting,
  onGenerate
}: {
  slot: MaterialSlot;
  asset: PetAsset | undefined;
  activeJob: GenerationJob | undefined;
  canEdit: boolean;
  generationError: string | undefined;
  hasFrameImage: boolean;
  isSubmitting: boolean;
  onGenerate: () => void;
}) {
  const isGenerating = Boolean(activeJob) || isSubmitting || asset?.status === "queued" || asset?.status === "generating";
  const status = isGenerating ? "generating" : asset?.status ?? "missing";
  const isReady = status === "ready";
  const previewState = materialCardPreviewState({
    asset,
    hasActiveJob: Boolean(activeJob),
    isSubmitting
  });
  const [videoRatio, setVideoRatio] = useState<number | null>(null);
  const cardStyle = videoRatio
    ? ({ "--asset-video-ratio": String(videoRatio) } as CSSProperties & Record<"--asset-video-ratio", string>)
    : undefined;

  return (
    <article className={isReady ? "card material-card ready-card" : "card material-card"} style={cardStyle}>
      <div className="preview">
        {previewState.kind === "video" ? (
          <video
            className="preview-video"
            src={previewState.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;

              if (video.videoHeight > 0) {
                setVideoRatio(video.videoWidth / video.videoHeight);
              }
            }}
          />
        ) : previewState.kind === "icon" ? (
          <span className="preview-icon">{previewState.icon}</span>
        ) : null}
      </div>
      <div className="card-body">
        <div className="card-title-row">
          <div>
            <h4>{slot.name}</h4>
          </div>
          <span className={badgeClassForAsset(status)}>{labelForAsset(status)}</span>
        </div>
        {activeJob ? <JobProgress job={activeJob} compact /> : null}
        {generationError ? (
          <p className="material-error-note" title={generationError}>
            {asset?.videoUrl ? "新生成失败，旧素材已保留" : `生成失败：${generationError}`}
          </p>
        ) : null}
        <div className="card-actions">
          <button className="button" disabled={!canEdit || !hasFrameImage || isGenerating} onClick={onGenerate}>
            {!canEdit
              ? "体验素材"
              : isSubmitting
                ? "提交中"
                : isGenerating
                  ? "生成中"
                  : isReady
                    ? `重新生成 ${slot.cost} 分`
                    : `生成 ${slot.cost} 分`}
          </button>
        </div>
      </div>
    </article>
  );
}

function PetsTab({
  currentUser,
  deletingPetId,
  pets,
  selectedPetId,
  onDeletePet,
  onRenamePet,
  onRecallPet
}: {
  currentUser: CurrentUser;
  deletingPetId: string | null;
  pets: Pet[];
  selectedPetId: string | undefined;
  onDeletePet: (pet: Pet) => void;
  onRenamePet: (petId: string, name: string) => Promise<void>;
  onRecallPet: () => void;
}) {
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petNameDraft, setPetNameDraft] = useState("");
  const [savingPetNameId, setSavingPetNameId] = useState<string | null>(null);

  function beginPetNameEdit(pet: Pet) {
    setEditingPetId(pet.id);
    setPetNameDraft(pet.name);
  }

  function cancelPetNameEdit() {
    if (savingPetNameId) {
      return;
    }

    setEditingPetId(null);
    setPetNameDraft("");
  }

  async function handlePetNameSubmit(event: FormEvent<HTMLFormElement>, pet: Pet) {
    event.preventDefault();

    const nextName = petNameDraft.trim();

    if (!nextName) {
      return;
    }

    if (nextName === pet.name) {
      setEditingPetId(null);
      setPetNameDraft("");
      return;
    }

    setSavingPetNameId(pet.id);

    try {
      await onRenamePet(pet.id, nextName);
      setEditingPetId(null);
      setPetNameDraft("");
    } finally {
      setSavingPetNameId(null);
    }
  }

  return (
    <section className="panel management-panel">
      <PanelTitle icon="🐾" title="我的宠物" subtitle="给每只小家伙整理名字、位置和动作包。" />
      <div className="pet-list-grid">
        {pets.map((pet) => {
          const canDeletePet = canDeletePetForAccount(currentUser, pet);
          const canEditPet = canDeletePet && !isReadonlyPet(pet);
          const renameLabel = canEditPet ? `改名：${pet.name}` : null;
          const isEditing = editingPetId === pet.id;
          const isDeleting = deletingPetId === pet.id;
          const isSavingPetName = savingPetNameId === pet.id;

          return (
            <article className={pet.id === selectedPetId ? "pet-list-card active" : "pet-list-card"} key={pet.id}>
              <div className="avatar pet-avatar">{pet.name.slice(0, 1)}</div>
              {isEditing ? (
                <form
                  className="pet-name-form pet-list-name-form"
                  onSubmit={(event) => void handlePetNameSubmit(event, pet)}
                >
                  <input
                    aria-label="猫咪名字"
                    className="input pet-name-input"
                    disabled={isSavingPetName}
                    maxLength={30}
                    required
                    value={petNameDraft}
                    onChange={(event) => setPetNameDraft(event.target.value)}
                  />
                  <button className="button tiny" disabled={isSavingPetName} type="submit">
                    {isSavingPetName ? "保存中" : "保存"}
                  </button>
                  <button
                    className="button ghost tiny"
                    disabled={isSavingPetName}
                    type="button"
                    onClick={cancelPetNameEdit}
                  >
                    取消
                  </button>
                </form>
              ) : (
                <div className="pet-list-name">
                  <h4>{pet.name}</h4>
                  <p>{pet.status}</p>
                </div>
              )}
              {renameLabel && !isEditing ? (
                <button
                  aria-label={renameLabel}
                  className="button secondary pet-list-rename-button"
                  disabled={isDeleting}
                  title={renameLabel}
                  type="button"
                  onClick={() => beginPetNameEdit(pet)}
                >
                  改名
                </button>
              ) : null}
              {canDeletePet ? (
                <button
                  className="button danger"
                  disabled={isDeleting || isSavingPetName}
                  onClick={() => onDeletePet(pet)}
                >
                  {isDeleting ? "删除中" : "删除"}
                </button>
              ) : null}
              {pet.host === "friend" ? (
                <button className="button" onClick={() => void onRecallPet()}>
                  召回
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeletePetDialog({
  pet,
  isDeleting,
  onCancel,
  onConfirm
}: {
  pet: Pet | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pet) {
      cancelButtonRef.current?.focus();
    }
  }, [pet]);

  useEffect(() => {
    if (!pet || isDeleting) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel, pet]);

  if (!pet) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <section
        aria-describedby="delete-pet-description"
        aria-labelledby="delete-pet-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <div>
          <span className="eyebrow">删除宠物</span>
          <h3 id="delete-pet-title">删除「{pet.name}」？</h3>
        </div>
        <p id="delete-pet-description">
          这只猫咪和它已生成、上传的素材会从账号素材库删除，不可恢复。
        </p>
        <div className="delete-dialog-summary">
          <span>当前状态</span>
          <strong>{pet.status}</strong>
          <span>已完成素材</span>
          <strong>{pet.materialsReady}</strong>
        </div>
        <div className="dialog-actions">
          <button
            className="button ghost"
            disabled={isDeleting}
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="button danger"
            disabled={isDeleting}
            type="button"
            onClick={() => void onConfirm()}
          >
            {isDeleting ? "删除中" : "确认删除"}
          </button>
        </div>
      </section>
    </div>
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
        <PanelTitle icon="👥" title="好友列表" subtitle="把猫咪临时送去好友桌面玩。" />
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
        <PanelTitle icon="🏠" title="托管状态" subtitle="每只猫同一时间只会出现在一个桌面。" />
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

function JobsTab({
  applyingJobIds,
  jobs,
  pets,
  slots,
  onApplyGeneratedVideo
}: {
  applyingJobIds: Set<string>;
  jobs: GenerationJob[];
  pets: Pet[];
  slots: MaterialSlot[];
  onApplyGeneratedVideo: (job: GenerationJob) => void;
}) {
  return (
    <section className="panel management-panel">
      <PanelTitle icon="📦" title="生成记录" subtitle="动作做好后会自动收进动作包。" />
      {jobs.length === 0 ? (
        <div className="empty-state">还没有开始做动作。上传绿幕形象图或点击动作卡片开始。</div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => {
            const generatedAtLabel = jobGeneratedAtLabel(job);
            const applyAction = jobGeneratedVideoApplyAction(job, pets);
            const isApplying = applyingJobIds.has(job.jobId);

            return (
              <div className="job-row" key={job.jobId}>
                <div>
                  <strong>{jobDisplayName(job, slots)}</strong>
                  {generatedAtLabel ? <p>{generatedAtLabel}</p> : null}
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
                {applyAction.kind !== "hidden" ? (
                  <button
                    className={
                      applyAction.kind === "available"
                        ? "button secondary job-apply-button"
                        : "button ghost job-apply-button"
                    }
                    disabled={applyAction.kind !== "available" || isApplying}
                    title={applyAction.kind === "unavailable" ? applyAction.reason : undefined}
                    type="button"
                    onClick={() => onApplyGeneratedVideo(job)}
                  >
                    {isApplying ? "应用中" : applyAction.label}
                  </button>
                ) : null}
                {job.prompt ? (
                  <details className="prompt-details job-prompt">
                    <summary>查看本次提示词</summary>
                    <pre>{job.prompt}</pre>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BillingTab({
  user,
  jobs,
  referralSummary
}: {
  user: CurrentUser;
  jobs: GenerationJob[];
  referralSummary: ReferralSummary;
}) {
  const spent = jobs.reduce((sum, job) => sum + job.cost, 0);
  const activeCode = referralSummary.activeCode;

  return (
    <section className="panel management-panel">
      <PanelTitle icon="💳" title="账单积分" subtitle="内测期间先用体验积分，正式付费规则后面再接。" />
      <div className="billing-grid">
        <div className="stat large-stat">
          <strong>{user.credits}</strong>
          <span>当前积分</span>
        </div>
        <div className="stat large-stat">
          <strong>{spent}</strong>
          <span>本次已消耗</span>
        </div>
        <div className="stat large-stat">
          <strong>{jobs.length}</strong>
          <span>生成记录</span>
        </div>
      </div>
      <div className="referral-summary-panel">
        <div>
          <span className="eyebrow">推荐分销</span>
          <h3>{activeCode ? activeCode.code : "暂未开通推荐码"}</h3>
          <p>
            {activeCode
              ? `好友使用你的推荐码注册，首次充值可享 ${referralSummary.firstRechargeDiscountPercent}% 优惠。`
              : "推荐码由后台为认证博主或合作用户开通。"}
          </p>
        </div>
        <div className="referral-summary-stats">
          <div className="stat">
            <strong>{referralSummary.referredUsers}</strong>
            <span>推荐注册</span>
          </div>
          <div className="stat">
            <strong>{formatCnyFromCents(referralSummary.rewardAmountCents)}</strong>
            <span>推广收益凭据</span>
          </div>
          <div className="stat">
            <strong>{referralSummary.rewardCredits}</strong>
            <span>收益积分记录</span>
          </div>
        </div>
        <p className="referral-summary-note">
          推荐收益暂不并入可消费积分，也暂不提现；后台会把它作为公司推广费用凭据。
        </p>
      </div>
    </section>
  );
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
        等了 {formatElapsed(job.createdAt)} · {labelForJobStatus(job.status)} · 小助手估计中
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
