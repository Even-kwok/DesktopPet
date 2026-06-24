import { statusMessageForActionResult } from "./studio-action-result.ts";

type RunStudioActionInput = {
  action: () => Promise<unknown> | unknown;
  refreshState: (actionResult?: unknown) => Promise<void> | void;
  setStatusMessage: (message: string) => void;
  successMessage: string;
  afterSuccess?: (result: unknown) => string | void;
  afterError?: (error: unknown) => string | void;
};

export async function runStudioAction(input: RunStudioActionInput) {
  try {
    const result = await input.action();
    await input.refreshState(result);
    const nextStatusMessage = input.afterSuccess?.(result);
    input.setStatusMessage(
      nextStatusMessage ?? statusMessageForActionResult(result, input.successMessage)
    );
  } catch (error) {
    await input.refreshState();
    const nextStatusMessage = input.afterError?.(error);
    input.setStatusMessage(
      nextStatusMessage ?? (error instanceof Error ? error.message : "操作失败，请稍后重试。")
    );
  }
}
