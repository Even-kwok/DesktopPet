import { NextResponse } from "next/server";
import { getMockJobResult } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  return NextResponse.json(getMockJobResult(jobId));
}
