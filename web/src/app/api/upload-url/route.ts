import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const requestSchema = z.object({
  petId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "INVALID_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const safeFileName = encodeURIComponent(parsed.data.fileName);

  return NextResponse.json({
    uploadUrl: `https://mock-upload.desktop.pet/${parsed.data.petId}/${safeFileName}`,
    publicUrl: `https://mock-cdn.desktop.pet/source-images/${parsed.data.petId}/${safeFileName}`,
    expiresIn: 600
  });
}
