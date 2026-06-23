import type { GenerationJob, GenerationJobStatus } from "./types.ts";

const terminalStatuses = new Set<GenerationJobStatus>(["succeeded", "failed", "expired"]);

export class GenerationJobPollingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationJobPollingError";
  }
}

export function isTerminalGenerationJob(job: Pick<GenerationJob, "status">) {
  return terminalStatuses.has(job.status);
}

export async function pollGenerationJobUntilTerminal(options: {
  job: GenerationJob;
  fetchJob: (jobId: string) => Promise<GenerationJob>;
  wait?: (milliseconds: number) => Promise<void>;
  intervalMs?: number;
  maxAttempts?: number;
  onProgress?: (job: GenerationJob, attempt: number) => void;
  onStatusError?: (error: Error, attempt: number) => void;
}) {
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const intervalMs = options.intervalMs ?? 5000;
  const maxAttempts = options.maxAttempts ?? 120;
  let latestJob = options.job;
  let lastStatusError: Error | null = null;
  let successfulStatusFetches = 0;

  if (isTerminalGenerationJob(latestJob)) {
    return latestJob;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.onProgress?.(latestJob, attempt);
    await wait(intervalMs);

    try {
      latestJob = await options.fetchJob(options.job.jobId);
      successfulStatusFetches += 1;
      lastStatusError = null;
    } catch (error) {
      lastStatusError = error instanceof Error ? error : new Error("Generation status request failed.");
      options.onStatusError?.(lastStatusError, attempt);
      continue;
    }

    options.onProgress?.(latestJob, attempt);

    if (isTerminalGenerationJob(latestJob)) {
      return latestJob;
    }
  }

  if (lastStatusError && successfulStatusFetches === 0) {
    throw new GenerationJobPollingError(lastStatusError.message);
  }

  return latestJob;
}
