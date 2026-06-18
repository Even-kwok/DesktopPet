import XCTest
@testable import CatDesktopPet

@MainActor
final class PetStudioViewModelLayoutTests: XCTestCase {
    private var settingsSuiteName: String!
    private var accountSuiteName: String!
    private var settingsDefaults: UserDefaults!
    private var accountDefaults: UserDefaults!

    override func setUp() {
        super.setUp()
        settingsSuiteName = "PetStudioViewModelLayoutTests.settings.\(UUID().uuidString)"
        accountSuiteName = "PetStudioViewModelLayoutTests.account.\(UUID().uuidString)"
        settingsDefaults = UserDefaults(suiteName: settingsSuiteName)
        accountDefaults = UserDefaults(suiteName: accountSuiteName)
    }

    override func tearDown() {
        settingsDefaults.removePersistentDomain(forName: settingsSuiteName)
        accountDefaults.removePersistentDomain(forName: accountSuiteName)
        settingsDefaults = nil
        accountDefaults = nil
        settingsSuiteName = nil
        accountSuiteName = nil
        super.tearDown()
    }

    func testCompactAccountPanelIsHiddenBeforeLogin() {
        let viewModel = makeViewModel()

        XCTAssertFalse(viewModel.shouldShowCompactAccountPanel)
    }

    func testCompactAccountPanelIsShownAfterLogin() {
        let accountStore = DesktopAccountSessionStore(defaults: accountDefaults)
        accountStore.save(
            DesktopAccountSession(
                id: "user_demo",
                name: "栗子主人",
                email: "demo@desktop.pet",
                credits: 10120,
                accessToken: "desktop-token",
                signedInAt: "2026-06-16T08:00:00Z"
            )
        )
        let viewModel = makeViewModel(accountSessionStore: accountStore)

        XCTAssertTrue(viewModel.shouldShowCompactAccountPanel)
    }

    func testInitialEmptyDraftDoesNotExposeStatusMessage() {
        let viewModel = makeViewModel()

        XCTAssertTrue(viewModel.statusMessage.isEmpty)
    }

    func testRecallActionOnlyShowsForSelectedRecallablePets() {
        let localPet = makeSyncedPetCard(
            id: "pet_local",
            ownership: "owned",
            displayState: "active"
        )
        let awayPet = makeSyncedPetCard(
            id: "pet_away",
            ownership: "away",
            displayState: "unavailable"
        )

        XCTAssertFalse(localPet.shouldShowRecallAction(isSelected: true))
        XCTAssertTrue(awayPet.shouldShowRecallAction(isSelected: true))
        XCTAssertFalse(awayPet.shouldShowRecallAction(isSelected: false))
    }

    private func makeViewModel(
        accountSessionStore: DesktopAccountSessionStore? = nil
    ) -> PetStudioViewModel {
        let settingsStore = SettingsStore(defaults: settingsDefaults)
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        return PetStudioViewModel(
            settingsStore: settingsStore,
            petColonyController: petColonyController,
            accountSessionStore: accountSessionStore ?? DesktopAccountSessionStore(defaults: accountDefaults),
            defaults: settingsDefaults
        )
    }

    private func makeSyncedPetCard(
        id: String,
        ownership: String,
        displayState: String
    ) -> DesktopSyncedPetCard {
        DesktopSyncedPetCard(
            id: id,
            petNumber: "CAT-20260616-0001",
            name: "栗子",
            ownership: ownership,
            displayState: displayState,
            avatarURL: nil,
            materialCount: 0
        )
    }
}
