import XCTest
@testable import CatDesktopPet

final class DesktopAccountSessionStoreTests: XCTestCase {
    private var suiteName: String!
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "DesktopAccountSessionStoreTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        suiteName = nil
        super.tearDown()
    }

    func testLoginPersistsAccountSessionWithToken() throws {
        let store = DesktopAccountSessionStore(defaults: defaults)

        let account = DesktopAccountSession(
            id: "user_demo",
            name: "栗子主人",
            email: "demo@desktop.pet",
            credits: 10120,
            accessToken: "desktop-token",
            signedInAt: "2026-06-16T08:00:00Z"
        )
        store.save(account)
        let restoredStore = DesktopAccountSessionStore(defaults: defaults)

        XCTAssertEqual(account.id, "user_demo")
        XCTAssertEqual(account.email, "demo@desktop.pet")
        XCTAssertEqual(restoredStore.currentAccount?.id, "user_demo")
        XCTAssertEqual(restoredStore.currentAccount?.accessToken, "desktop-token")
        XCTAssertEqual(restoredStore.isSignedIn, true)
    }

    func testSignOutClearsAccountSession() throws {
        let store = DesktopAccountSessionStore(defaults: defaults)
        store.save(
            DesktopAccountSession(
                id: "user_demo",
                name: "栗子主人",
                email: "demo@desktop.pet",
                credits: 10120,
                accessToken: "desktop-token",
                signedInAt: "2026-06-16T08:00:00Z"
            )
        )

        store.signOut()

        XCTAssertNil(store.currentAccount)
        XCTAssertEqual(store.isSignedIn, false)
    }
}
