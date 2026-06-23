import assert from "node:assert/strict";
import test from "node:test";
import { SleepRecoveryCoordinator } from "../src/shared/sleep-recovery-coordinator.ts";

test("willSleep prepares visible desktop pets once", () => {
  let prepareCount = 0;
  let resumeCount = 0;
  const coordinator = new SleepRecoveryCoordinator(
    () => {
      prepareCount += 1;
    },
    () => {
      resumeCount += 1;
    },
    (resume) => resume()
  );

  coordinator.systemWillSleep();
  coordinator.systemWillSleep();

  assert.equal(prepareCount, 1);
  assert.equal(resumeCount, 0);
});

test("only latest wake notification resumes", () => {
  let resumeCount = 0;
  const scheduled: Array<() => void> = [];
  const coordinator = new SleepRecoveryCoordinator(
    () => undefined,
    () => {
      resumeCount += 1;
    },
    (resume) => scheduled.push(resume)
  );

  coordinator.systemWillSleep();
  coordinator.systemDidWake();
  coordinator.systemDidWake();

  scheduled[0]();
  assert.equal(resumeCount, 0);

  scheduled[1]();
  assert.equal(resumeCount, 1);
});
