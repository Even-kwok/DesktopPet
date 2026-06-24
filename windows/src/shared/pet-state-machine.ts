export type PetState =
  | "hidden"
  | "idle"
  | "sleeping"
  | "clicked"
  | "catchingBug"
  | "idleAction"
  | "socialInteraction"
  | "grabbed"
  | "dropped";

export type PetEvent =
  | "show"
  | "hide"
  | "click"
  | "mouseOverPet"
  | "idleActionDue"
  | "nearbyPet"
  | "reactionFinished"
  | "reactionUnavailable"
  | "dragStarted"
  | "dragEnded"
  | "sleep"
  | "wake";

export type StateChanged = (state: PetState) => void;
export type ReturnToIdleScheduler = (callback: () => void, delayMs: number) => void;

export class PetStateMachine {
  #state: PetState = "hidden";
  #token = 0;
  readonly #onStateChanged?: StateChanged;
  readonly #scheduleReturnToIdle: ReturnToIdleScheduler;

  constructor(
    onStateChanged?: StateChanged,
    scheduleReturnToIdle: ReturnToIdleScheduler = (callback, delayMs) => {
      setTimeout(callback, delayMs);
    }
  ) {
    this.#onStateChanged = onStateChanged;
    this.#scheduleReturnToIdle = scheduleReturnToIdle;
  }

  get state() {
    return this.#state;
  }

  send(event: PetEvent) {
    switch (event) {
      case "show":
        this.#transitionTo("idle");
        break;
      case "hide":
        this.#transitionTo("hidden");
        break;
      case "sleep":
        if (this.#state === "idle") {
          this.#transitionTo("sleeping");
        }
        break;
      case "wake":
        if (this.#state === "sleeping") {
          this.#transitionTo("idle");
        }
        break;
      case "click":
        if (this.#state !== "grabbed" && this.#state !== "hidden") {
          this.#transitionTo("clicked");
        }
        break;
      case "mouseOverPet":
        if (this.#state === "idle") {
          this.#transitionTo("catchingBug");
        }
        break;
      case "idleActionDue":
        if (this.#state === "idle") {
          this.#transitionTo("idleAction");
        }
        break;
      case "nearbyPet":
        if (this.#state === "idle") {
          this.#transitionTo("socialInteraction");
        }
        break;
      case "reactionFinished":
        if (["sleeping", "clicked", "catchingBug", "idleAction", "socialInteraction"].includes(this.#state)) {
          this.#transitionTo("idle");
        }
        break;
      case "reactionUnavailable":
        if (["clicked", "catchingBug", "idleAction", "socialInteraction"].includes(this.#state)) {
          this.#returnToIdle(120);
        }
        break;
      case "dragStarted":
        if (this.#state !== "hidden") {
          this.#transitionTo("grabbed");
        }
        break;
      case "dragEnded":
        if (this.#state === "grabbed") {
          this.#transitionTo("dropped");
          this.#returnToIdle(240);
        }
        break;
    }
  }

  #transitionTo(nextState: PetState) {
    if (this.#state === nextState) {
      return;
    }

    this.#state = nextState;
    this.#token += 1;
    this.#onStateChanged?.(nextState);
  }

  #returnToIdle(delayMs: number) {
    const token = this.#token;

    this.#scheduleReturnToIdle(() => {
      if (this.#token === token && this.#state !== "hidden") {
        this.#transitionTo("idle");
      }
    }, delayMs);
  }
}
