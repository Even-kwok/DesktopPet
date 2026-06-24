export type PetVideoImportMetadata = {
  fileSizeBytes: number;
  durationSeconds: number;
  hasVideoTrack: boolean;
};

export type PetVideoImportReview = {
  canImport: boolean;
  blockingMessages: string[];
  warningMessages: string[];
};

export const unreadablePetVideoImportMessage = "视频打不开，请换一个 MP4 或 MOV。";

const maxImportVideoBytes = 300 * 1024 * 1024;
const longImportVideoSeconds = 15;
const maxImportVideoSeconds = 60;
const largeImportVideoBytes = 80 * 1024 * 1024;

export function reviewPetVideoImport(metadata: PetVideoImportMetadata): PetVideoImportReview {
  const blockingMessages: string[] = [];
  const warningMessages: string[] = [];

  if (!metadata.hasVideoTrack) {
    blockingMessages.push("这段视频没有视频画面，请换一个 MP4 或 MOV。");
  }

  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
    blockingMessages.push("这段视频时长异常，请换一个能正常播放的视频。");
  } else if (metadata.durationSeconds > maxImportVideoSeconds) {
    blockingMessages.push("这段视频太长了，请换 60 秒以内的视频。");
  } else if (metadata.durationSeconds > longImportVideoSeconds) {
    warningMessages.push("这段视频有点长，作为桌宠动作可能不够轻快。");
  }

  if (metadata.fileSizeBytes > maxImportVideoBytes) {
    blockingMessages.push("视频有点太大，请换 300MB 以内的视频。");
  } else if (metadata.fileSizeBytes > largeImportVideoBytes) {
    warningMessages.push("视频有点大，播放和同步可能更慢。");
  }

  return {
    canImport: blockingMessages.length === 0,
    blockingMessages,
    warningMessages
  };
}
