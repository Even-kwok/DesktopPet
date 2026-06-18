import XCTest
@testable import CatDesktopPet

@MainActor
final class PetDeletionTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "PetDeletionTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testDeletingOnlyPetLeavesNoLocalPets() {
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.setPetName("栗子", for: 0)

        settingsStore.removePet(at: 0)

        XCTAssertEqual(settingsStore.petCount, 0)
        XCTAssertEqual(settingsStore.petName(for: 0), "Pet 1")
    }

    func testColonyCanDeleteOnlyVisiblePet() {
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.petCount = 1
        settingsStore.isPetVisible = true
        let colonyController = PetColonyController(settingsStore: settingsStore)

        let didShowAnyPet = colonyController.removePet(at: 0)

        XCTAssertFalse(didShowAnyPet)
        XCTAssertEqual(settingsStore.petCount, 0)
    }

    func testPetMenuAllowsDeletingOnlyPet() {
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.petCount = 1
        let colonyController = PetColonyController(settingsStore: settingsStore)
        let statusBarController = StatusBarController(
            settingsStore: settingsStore,
            petColonyController: colonyController,
            openStudio: {}
        )

        let petsMenu = statusBarController.makeDockMenu()
            .items
            .first(where: { $0.title == "宠物" })?
            .submenu
        let removeItem = petsMenu?.items.first(where: { $0.title == "删除宠物" })

        XCTAssertEqual(removeItem?.isEnabled, true)
        XCTAssertEqual(removeItem?.submenu?.items.count, 1)
    }
}
