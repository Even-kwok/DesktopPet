export type WakeResumeScheduler = (resume: () => void) => void;

export class SleepRecoveryCoordinator {
  #wakeGeneration = 0;
  #isPreparedForSleep = false;
  readonly #prepareForSleep: () => void;
  readonly #resumeAfterWake: () => void;
  readonly #scheduleWakeResume: WakeResumeScheduler;

  constructor(
    prepareForSleep: () => void,
    resumeAfterWake: () => void,
    scheduleWakeResume: WakeResumeScheduler = (resume) => {
      setTimeout(resume, 750);
    }
  ) {
    this.#prepareForSleep = prepareForSleep;
    this.#resumeAfterWake = resumeAfterWake;
    this.#scheduleWakeResume = scheduleWakeResume;
  }

  systemWillSleep() {
    this.#wakeGeneration += 1;

    if (this.#isPreparedForSleep) {
      return;
    }

    this.#isPreparedForSleep = true;
    this.#prepareForSleep();
  }

  systemDidWake() {
    this.#wakeGeneration += 1;
    const generation = this.#wakeGeneration;

    this.#scheduleWakeResume(() => {
      if (this.#wakeGeneration !== generation) {
        return;
      }

      this.#isPreparedForSleep = false;
      this.#resumeAfterWake();
    });
  }
}
