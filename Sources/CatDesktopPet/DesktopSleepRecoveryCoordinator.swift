import Foundation

final class DesktopSleepRecoveryCoordinator {
    typealias WakeResumeScheduler = (@escaping () -> Void) -> Void

    private let prepareForSleep: () -> Void
    private let resumeAfterWake: () -> Void
    private let scheduleWakeResume: WakeResumeScheduler
    private var wakeGeneration = 0
    private var isPreparedForSleep = false

    init(
        prepareForSleep: @escaping () -> Void,
        resumeAfterWake: @escaping () -> Void,
        scheduleWakeResume: @escaping WakeResumeScheduler = { resume in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
                resume()
            }
        }
    ) {
        self.prepareForSleep = prepareForSleep
        self.resumeAfterWake = resumeAfterWake
        self.scheduleWakeResume = scheduleWakeResume
    }

    func systemWillSleep() {
        wakeGeneration += 1

        guard !isPreparedForSleep else {
            return
        }

        isPreparedForSleep = true
        prepareForSleep()
    }

    func systemDidWake() {
        wakeGeneration += 1
        let generation = wakeGeneration

        scheduleWakeResume { [weak self] in
            guard let self, self.wakeGeneration == generation else {
                return
            }

            self.isPreparedForSleep = false
            self.resumeAfterWake()
        }
    }
}
