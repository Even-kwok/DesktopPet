import XCTest
@testable import CatDesktopPet

@MainActor
final class PetSizeSettingsTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "PetSizeSettingsTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testPetSizeScaleDefaultsToMaxAndClampsToThirtyPercent() {
        let settingsStore = SettingsStore(defaults: defaults)

        XCTAssertEqual(settingsStore.petSizeScale(for: 0), 1.0)

        settingsStore.setPetSizeScale(0.1, for: 0)
        XCTAssertEqual(settingsStore.petSizeScale(for: 0), 0.3)

        settingsStore.setPetSizeScale(1.4, for: 1)
        XCTAssertEqual(settingsStore.petSizeScale(for: 1), 1.0)
    }

    func testPetSizeScaleIsStoredPerPetAndMovesWithPetData() {
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.petCount = 2
        settingsStore.setPetSizeScale(0.8, for: 0)
        settingsStore.setPetSizeScale(0.3, for: 1)

        XCTAssertEqual(settingsStore.petSizeScale(for: 0), 0.8)
        XCTAssertEqual(settingsStore.petSizeScale(for: 1), 0.3)

        settingsStore.removePet(at: 0)

        XCTAssertEqual(settingsStore.petSizeScale(for: 0), 0.3)
        XCTAssertEqual(settingsStore.petSizeScale(for: 1), 1.0)
    }

    func testStatusMenuShowsPerPetSizeChoices() throws {
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.petCount = 2
        settingsStore.setPetName("栗子", for: 0)
        settingsStore.setPetName("团子", for: 1)
        settingsStore.setPetSizeScale(0.3, for: 1)
        let colonyController = PetColonyController(settingsStore: settingsStore)
        let statusBarController = StatusBarController(
            settingsStore: settingsStore,
            petColonyController: colonyController,
            openStudio: {}
        )

        let dockMenu = statusBarController.makeDockMenu()
        let petsMenu = try XCTUnwrap(dockMenu.item(withTitle: "宠物")?.submenu)
        let sizeMenu = try XCTUnwrap(petsMenu.item(withTitle: "调整大小")?.submenu)
        let chestnutMenu = try XCTUnwrap(sizeMenu.item(withTitle: "栗子")?.submenu)
        let dangoMenu = try XCTUnwrap(sizeMenu.item(withTitle: "团子")?.submenu)

        XCTAssertEqual(
            chestnutMenu.items.map(\.title),
            ["最大 100%", "90%", "80%", "70%", "60%", "50%", "40%", "30%"]
        )
        XCTAssertEqual(chestnutMenu.item(withTitle: "最大 100%")?.state, .on)
        XCTAssertEqual(dangoMenu.item(withTitle: "30%")?.state, .on)
    }
}
