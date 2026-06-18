import { NextResponse } from "next/server";
import { syncAccountGenerationJobStatus } from "@/lib/server/account-data-store";
import { getCurrentAuthContext } from "@/lib/server/auth";
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
  const auth = await getCurrentAuthContext();

  if (auth.user) {
    try {
      const storedJob = await syncAccountGenerationJobStatus(auth.user, jobId);

      if (storedJob) {
        return NextResponse.json(storedJob);
      }
    } catch (error: unknown) {
      return NextResponse.json(
        {
          error: "GENERATION_JOB_STATUS_FAILED",
          details: error instanceof Error ? error.message : "Generation job status request failed."
        },
        { status: 502 }
      );
    }
  }

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
