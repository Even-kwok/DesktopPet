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

    func testLoginFieldsStartBlank() {
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.loginEmail, "")
        XCTAssertEqual(viewModel.loginPassword, "")
    }

    func testSyncedPetCardsRemainVisibleAfterSignOut() async throws {
        let accountStore = signedInAccountStore()
        let viewModel = makeViewModel(
            accountSessionStore: accountStore,
            desktopSyncClient: makeStubbedSyncClient()
        )

        try await syncRemotePetCards(in: viewModel)
        XCTAssertEqual(viewModel.syncedPetCards.map(\.id), ["pet_orange"])

        viewModel.signOutAccount()

        XCTAssertNil(viewModel.currentAccount)
        XCTAssertEqual(viewModel.syncedPetCards.map(\.id), ["pet_orange"])
        XCTAssertEqual(viewModel.selectedSyncedPetID, "pet_orange")
    }

    func testSyncedPetCardsRestoreAfterRelaunch() async throws {
        let accountStore = signedInAccountStore()
        let viewModel = makeViewModel(
            accountSessionStore: accountStore,
            desktopSyncClient: makeStubbedSyncClient()
        )

        try await syncRemotePetCards(in: viewModel)

        let relaunchedViewModel = makeViewModel()

        XCTAssertEqual(relaunchedViewModel.syncedPetCards.map(\.id), ["pet_orange"])
        XCTAssertEqual(relaunchedViewModel.selectedSyncedPetID, "pet_orange")
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

    func testHostingActionOnlyAllowsOwnedPetsOnThisDesktop() {
        let localPet = makeSyncedPetCard(
            id: "pet_local",
            ownership: "owned",
            displayState: "active"
        )
        let hostedPet = makeSyncedPetCard(
            id: "pet_hosted",
            ownership: "hosted",
            displayState: "active"
        )
        let awayPet = makeSyncedPetCard(
            id: "pet_away",
            ownership: "away",
            displayState: "unavailable"
        )

        XCTAssertTrue(localPet.canRequestHosting)
        XCTAssertFalse(hostedPet.canRequestHosting)
        XCTAssertFalse(awayPet.canRequestHosting)
    }

    func testGreenScreenImageCanBeConfirmedWithoutGeneratingFrontImage() {
        settingsDefaults.set("/tmp/cat-green-screen.png", forKey: "studio.pet.0.sourceImagePath")
        let viewModel = makeViewModel()

        XCTAssertTrue(viewModel.canConfirmFrontImage)
        XCTAssertFalse(viewModel.canGenerate(slot: .idleLoop))

        viewModel.confirmFrontImage()

        XCTAssertTrue(viewModel.isFrontImageConfirmed)
        XCTAssertTrue(viewModel.canGenerate(slot: .idleLoop))
    }

    private func makeViewModel(
        accountSessionStore: DesktopAccountSessionStore? = nil,
        desktopSyncClient: DesktopPetSyncClient = DesktopPetSyncClient()
    ) -> PetStudioViewModel {
        let settingsStore = SettingsStore(defaults: settingsDefaults)
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        return PetStudioViewModel(
            settingsStore: settingsStore,
            petColonyController: petColonyController,
            desktopSyncClient: desktopSyncClient,
            accountSessionStore: accountSessionStore ?? DesktopAccountSessionStore(defaults: accountDefaults),
            defaults: settingsDefaults
        )
    }

    private func signedInAccountStore() -> DesktopAccountSessionStore {
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
        return accountStore
    }

    private func makeStubbedSyncClient() -> DesktopPetSyncClient {
        PetStudioURLProtocolStub.requestHandler = { request in
            switch request.url?.absoluteString {
            case "https://example.com/api/desktop/pets":
                XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer desktop-token")
                return (
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: ["Content-Type": "application/json"]
                    )!,
                    Data(
                        """
                        {
                          "version": 1,
                          "generatedAt": "2026-06-16T08:00:00.000Z",
                          "account": {
                            "id": "user_demo",
                            "name": "栗子主人",
                            "email": "demo@desktop.pet",
                            "credits": 10120
                          },
                          "pets": [
                            {
                              "id": "pet_orange",
                              "petNumber": "CAT-20260616-0001",
                              "ownerUserId": "user_demo",
                              "currentHostUserId": "user_demo",
                              "name": "栗子",
                              "type": "cat",
                              "ownership": "owned",
                              "displayState": "active",
                              "avatarUrl": null,
                              "materials": []
                            }
                          ]
                        }
                        """.utf8
                    )
                )
            case "https://example.com/api/friends":
                return (
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: ["Content-Type": "application/json"]
                    )!,
                    Data(#"{"friends":[]}"#.utf8)
                )
            case "https://example.com/api/hosting/requests":
                return (
                    HTTPURLResponse(
                        url: request.url!,
                        statusCode: 200,
                        httpVersion: nil,
                        headerFields: ["Content-Type": "application/json"]
                    )!,
                    Data(#"{"requests":[]}"#.utf8)
                )
            default:
                throw URLError(.badURL)
            }
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [PetStudioURLProtocolStub.self]
        return DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: URLSession(configuration: configuration)
        )
    }

    private func syncRemotePetCards(in viewModel: PetStudioViewModel) async throws {
        viewModel.syncFromWebStudio()

        for _ in 0..<100 {
            if !viewModel.isSyncingDesktopBundle {
                return
            }

            try await Task.sleep(nanoseconds: 10_000_000)
        }

        XCTFail("Timed out waiting for desktop sync to finish.")
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

private final class PetStudioURLProtocolStub: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
