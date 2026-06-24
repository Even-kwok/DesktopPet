export class StudioActionBusyError extends Error {
  constructor() {
    super("操作正在进行中，请稍候。");
    this.name = "StudioActionBusyError";
  }
}

export function createSingleFlightActionGroup() {
  let currentAction: { key: string; promise: Promise<unknown> } | undefined;

  return {
    run: <T>(key: string, action: () => Promise<T>) => {
      if (currentAction) {
        if (currentAction.key === key) {
          return currentAction.promise as Promise<T>;
        }

        return Promise.reject(new StudioActionBusyError());
      }

      const nextAction = action().finally(() => {
        if (currentAction?.promise === nextAction) {
          currentAction = undefined;
        }
      });
      currentAction = { key, promise: nextAction };
      return nextAction;
    }
  };
}
