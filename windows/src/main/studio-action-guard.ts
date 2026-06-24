export function createSingleFlightActionGroup() {
  let currentAction: Promise<unknown> | undefined;

  return {
    run: <T>(action: () => Promise<T>) => {
      if (currentAction) {
        return currentAction as Promise<T>;
      }

      const nextAction = action().finally(() => {
        if (currentAction === nextAction) {
          currentAction = undefined;
        }
      });
      currentAction = nextAction;
      return nextAction;
    }
  };
}
