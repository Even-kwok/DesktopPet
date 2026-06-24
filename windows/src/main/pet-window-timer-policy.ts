import type { PetEvent, PetState } from "../shared/pet-state-machine.ts";

export type TimedPetWindowEvent = Extract<PetEvent, "sleep" | "idleActionDue">;

export type TimedPetWindowActionPlan =
  | { action: "ignore" }
  | { action: "reschedule" }
  | { action: "send"; stateMachineEvent: TimedPetWindowEvent };

export function planTimedPetWindowAction(input: {
  state: PetState;
  hasAvailableVideo: boolean;
  hasFrame: boolean;
  isVisible: boolean;
  isCursorNearPet: boolean;
  stateMachineEvent: TimedPetWindowEvent;
}): TimedPetWindowActionPlan {
  if (input.state !== "idle" || !input.hasAvailableVideo || !input.hasFrame || !input.isVisible) {
    return { action: "ignore" };
  }

  if (input.isCursorNearPet) {
    return { action: "reschedule" };
  }

  return { action: "send", stateMachineEvent: input.stateMachineEvent };
}
