import { NextResponse } from "next/server";
import { assertAccountPetEditable, saveAccountPetImages } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";
import { getBackendStatus, getStorageBuckets, getSupabaseAdminClient } from "@/lib/supabase/server";
import type { CurrentUser, SourceImageUploadResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxSourceImageBytes = 30 * 1024 * 1024;

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

export async function POST(request: Request) {
  const auth = await getCurrentAuthContext();

  if (!auth.user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "INVALID_FORM_DATA" }, { status: 400 });
  }

  const petId = formData.get("petId");
  const file = formData.get("file");

  if (typeof petId !== "string" || !petId) {
    return NextResponse.json({ error: "INVALID_PET_ID" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  }

  if (!supportedTypes.has(file.type)) {
    return NextResponse.json({ error: "UNSUPPORTED_IMAGE_TYPE" }, { status: 400 });
  }

  if (file.size > maxSourceImageBytes) {
    return NextResponse.json(
      {
        error: "SOURCE_IMAGE_TOO_LARGE",
        details: `图片不能超过 ${formatBytes(maxSourceImageBytes)}，当前约 ${formatBytes(file.size)}。`
      },
      { status: 413 }
    );
  }

  const editabilityResponse = await assertEditablePetResponse(auth.user, petId);

  if (editabilityResponse) {
    return editabilityResponse;
  }

  const bucket = getStorageBuckets().sourceImages;
  const fileExtension = extensionForContentType(file.type);
  const storagePath = `${petId}/${crypto.randomUUID()}.${fileExtension}`;
  const backend = getBackendStatus();

  if (backend.mode === "mock") {
    const encodedPath = storagePath
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const response = {
      mode: "mock",
      bucket,
      storagePath,
      publicUrl: `https://mock-cdn.desktop.pet/${bucket}/${encodedPath}`
    } satisfies SourceImageUploadResponse;

    const pet = await saveAccountPetImages({
      account: auth.user,
      petId,
      imageUrl: response.publicUrl
    });

    return NextResponse.json({ ...response, pet });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadResult = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (uploadResult.error) {
    console.error("Source image upload failed", {
      bucket,
      storagePath,
      fileSize: file.size,
      fileType: file.type,
      message: uploadResult.error.message
    });

    return NextResponse.json(
      {
        error: "SOURCE_IMAGE_UPLOAD_FAILED",
        details: uploadResult.error.message
      },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  const response = {
    mode: "supabase",
    bucket,
    storagePath,
    publicUrl
  } satisfies SourceImageUploadResponse;

  const pet = await saveAccountPetImages({
    account: auth.user,
    petId,
    imageUrl: response.publicUrl
  });

  return NextResponse.json({ ...response, pet });
}

async function assertEditablePetResponse(
  account: CurrentUser,
  petId: string
) {
  try {
    await assertAccountPetEditable({ account, petId });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SOURCE_IMAGE_UPLOAD_FAILED";

    return NextResponse.json(
      {
        error:
          message === "PET_NOT_FOUND" || message === "PET_READONLY"
            ? message
            : "SOURCE_IMAGE_UPLOAD_FAILED",
        details:
          message === "PET_NOT_FOUND"
            ? "没有找到可上传形象图的猫咪。"
            : message === "PET_READONLY"
              ? "体验猫不能更换形象图，可以添加新的猫咪后上传。"
              : message
      },
      { status: message === "PET_NOT_FOUND" ? 404 : message === "PET_READONLY" ? 403 : 500 }
    );
  }
}
