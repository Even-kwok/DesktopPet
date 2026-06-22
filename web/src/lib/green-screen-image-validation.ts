export type GreenScreenImageMetadata = {
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  greenEdgeRatio?: number;
};

export type GreenScreenImageReview = {
  canUse: boolean;
  errors: string[];
  warnings: string[];
};

const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxImageBytes = 30 * 1024 * 1024;
const minImageSide = 512;

export function reviewGreenScreenImage(metadata: GreenScreenImageMetadata): GreenScreenImageReview {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!supportedImageTypes.has(metadata.contentType)) {
    errors.push("请上传 PNG、JPG 或 WebP 格式的绿幕图。");
  }

  if (metadata.sizeBytes > maxImageBytes) {
    errors.push("图片有点太大，请换一张 30MB 以内的绿幕图。");
  }

  if (metadata.width < minImageSide || metadata.height < minImageSide) {
    errors.push("图片至少 512 x 512，这样小猫到桌面上才清楚。");
  }

  if (metadata.greenEdgeRatio !== undefined && metadata.greenEdgeRatio < 0.55) {
    warnings.push("这张图的边缘绿幕不太明显，生成动作时可能不够干净。");
  }

  return {
    canUse: errors.length === 0,
    errors,
    warnings
  };
}
