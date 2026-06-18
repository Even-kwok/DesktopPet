import XCTest
@testable import CatDesktopPet

final class DesktopSleepRecoveryCoordinatorTests: XCTestCase {
    func testWillSleepPreparesVisibleDesktopPets() {
        var prepareCount = 0
        var resumeCount = 0
        let coordinator = DesktopSleepRecoveryCoordinator(
            prepareForSleep: { prepareCount += 1 },
            resumeAfterWake: { resumeCount += 1 },
            scheduleWakeResume: { resume in resume() }
        )

        coordinator.systemWillSleep()

        XCTAssertEqual(prepareCount, 1)
        XCTAssertEqual(resumeCount, 0)
    }

    func testDidWakeResumesAfterSchedulerRuns() {
        var prepareCount = 0
        var resumeCount = 0
        var scheduledResume: (() -> Void)?
        let coordinator = DesktopSleepRecoveryCoordinator(
            prepareForSleep: { prepareCount += 1 },
            resumeAfterWake: { resumeCount += 1 },
            scheduleWakeResume: { resume in scheduledResume = resume }
        )

        coordinator.systemWillSleep()
        coordinator.systemDidWake()

        XCTAssertEqual(prepareCount, 1)
        XCTAssertEqual(resumeCount, 0)

        scheduledResume?()

        XCTAssertEqual(resumeCount, 1)
    }

    func testRepeatedWakeNotificationsOnlyResumeLatestRequest() {
        var resumeCount = 0
        var scheduledResumes: [() -> Void] = []
        let coordinator = DesktopSleepRecoveryCoordinator(
            prepareForSleep: {},
            resumeAfterWake: { resumeCount += 1 },
            scheduleWakeResume: { resume in scheduledResumes.append(resume) }
        )

        coordinator.systemWillSleep()
        coordinator.systemDidWake()
        coordinator.systemDidWake()

        XCTAssertEqual(scheduledResumes.count, 2)

        scheduledResumes[0]()
        XCTAssertEqual(resumeCount, 0)

        scheduledResumes[1]()
        XCTAssertEqual(resumeCount, 1)
    }
}
