export type ShowPetsActionPlan =
  | { isPetVisible: true; importIdleLoop: false }
  | { isPetVisible: false; importIdleLoop: true; petIndex: 0; slot: "idle_loop" };

export function showPetsActionPlan(didShowAnyPet: boolean): ShowPetsActionPlan {
  if (didShowAnyPet) {
    return { isPetVisible: true, importIdleLoop: false };
  }

  return { isPetVisible: false, importIdleLoop: true, petIndex: 0, slot: "idle_loop" };
}
