export type ExistingInstanceReopenAction = "resumePets" | "showStudio" | "refreshTray";

export type InitialLaunchActions = {
  showStudio: boolean;
  showsFirstRunPrompt: boolean;
};

export function singleInstanceStartupPlan(hasSingleInstanceLock: boolean) {
  return hasSingleInstanceLock
    ? { shouldBootstrap: true, shouldQuit: false }
    : { shouldBootstrap: false, shouldQuit: true };
}

export function initialLaunchActions(): InitialLaunchActions {
  return {
    showStudio: true,
    showsFirstRunPrompt: false
  };
}

export function existingInstanceReopenActions(): ExistingInstanceReopenAction[] {
  return ["resumePets", "showStudio", "refreshTray"];
}
