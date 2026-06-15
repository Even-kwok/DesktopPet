import { NextResponse } from "next/server";
import { getJimengVideoJob, isJimengJobId } from "@/lib/server/jimeng";
import { getMockJobResult } from "@/lib/server/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;

  if (isJimengJobId(jobId)) {
    try {
      const providerJob = await getJimengVideoJob(jobId);

      if (providerJob) {
        return NextResponse.json(providerJob);
      }
    } catch (error: unknown) {
      return NextResponse.json(
        {
          error: "JIMENG_JOB_STATUS_FAILED",
          details: error instanceof Error ? error.message : "Provider status request failed."
        },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(getMockJobResult(jobId));
}
