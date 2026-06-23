export type ExistingInstanceReopenAction = "resumePets" | "showStudio" | "refreshTray";

export function singleInstanceStartupPlan(hasSingleInstanceLock: boolean) {
  return hasSingleInstanceLock
    ? { shouldBootstrap: true, shouldQuit: false }
    : { shouldBootstrap: false, shouldQuit: true };
}

export function existingInstanceReopenActions(): ExistingInstanceReopenAction[] {
  return ["resumePets", "showStudio", "refreshTray"];
}
