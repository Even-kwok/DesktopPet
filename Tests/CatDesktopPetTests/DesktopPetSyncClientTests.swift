import XCTest
@testable import CatDesktopPet

final class DesktopPetSyncClientTests: XCTestCase {
    func testDecodesDesktopPetBundle() throws {
        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-16T08:00:00.000Z",
          "account": {
            "id": "user_demo",
            "name": "栗子主人",
            "email": "demo@desktop.pet",
            "credits": 10120
          },
          "sync": {
            "mode": "mock",
            "source": "account",
            "recommendedPollSeconds": 300
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
              "avatarUrl": "https://example.com/front.png",
              "materials": [
                {
                  "slot": "idle_loop",
                  "name": "待机循环",
                  "videoUrl": "https://example.com/idle.mp4",
                  "status": "ready"
                }
              ]
            }
          ]
        }
        """

        let bundle = try JSONDecoder.desktopPetSync.decode(
            DesktopPetBundle.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(bundle.version, 1)
        XCTAssertEqual(bundle.account?.id, "user_demo")
        XCTAssertEqual(bundle.account?.credits, 10120)
        XCTAssertEqual(bundle.sync?.recommendedPollSeconds, 300)
        XCTAssertEqual(bundle.pets.first?.name, "栗子")
        XCTAssertEqual(bundle.pets.first?.petNumber, "CAT-20260616-0001")
        XCTAssertEqual(bundle.pets.first?.ownerUserId, "user_demo")
        XCTAssertEqual(bundle.pets.first?.currentHostUserId, "user_demo")
        XCTAssertEqual(bundle.pets.first?.ownership, "owned")
        XCTAssertEqual(bundle.pets.first?.displayState, "active")
        XCTAssertEqual(bundle.pets.first?.materials.first?.slot, .idleLoop)
        XCTAssertEqual(bundle.pets.first?.hasIdleLoopMaterial, true)
        XCTAssertEqual(bundle.pets.first?.isDisplayableOnDesktop, true)
    }

    func testPetWithoutIdleLoopIsNotDisplayable() throws {
        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-16T08:00:00.000Z",
          "pets": [
            {
              "id": "pet_orange",
              "name": "栗子",
              "type": "cat",
              "avatarUrl": null,
              "materials": [
                {
                  "slot": "stretch",
                  "name": "伸懒腰",
                  "videoUrl": "https://example.com/stretch.mp4",
                  "status": "ready"
                }
              ]
            }
          ]
        }
        """

        let bundle = try JSONDecoder.desktopPetSync.decode(
            DesktopPetBundle.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(bundle.pets.first?.hasIdleLoopMaterial, false)
    }

    func testDecodesLatestActionLibrarySlots() throws {
        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-21T08:00:00.000Z",
          "pets": [
            {
              "id": "pet_orange",
              "name": "栗子",
              "type": "cat",
              "avatarUrl": null,
              "materials": [
                {
                  "slot": "look_at_camera",
                  "name": "看镜头",
                  "videoUrl": "https://example.com/look.mp4",
                  "status": "ready"
                },
                {
                  "slot": "salary_cat_stinky_dance",
                  "name": "跳月薪喵散屁舞",
                  "videoUrl": "https://example.com/dance.mp4",
                  "status": "ready"
                },
                {
                  "slot": "head_bob_dance",
                  "name": "摇头晃脑舞",
                  "videoUrl": "https://example.com/head-bob.mp4",
                  "status": "ready"
                }
              ]
            }
          ]
        }
        """

        let bundle = try JSONDecoder.desktopPetSync.decode(
            DesktopPetBundle.self,
            from: Data(json.utf8)
        )
        let slots = bundle.pets.first?.materials.map(\.slot)

        XCTAssertEqual(slots, [.lookAtCamera, .salaryCatStinkyDance, .headBobDance])
        XCTAssertEqual(PetActionSlot.lookAtCamera.displayName, "看镜头")
        XCTAssertEqual(PetActionSlot.salaryCatStinkyDance.materialGroup, .idleLife)
        XCTAssertEqual(PetActionSlot.headBobDance.triggerDescription, "待机随机")
    }

    func testActionSlotMenuDoesNotExposeRemovedDragLoopPlaceholder() {
        XCTAssertFalse(PetActionSlot.allCases.map(\.rawValue).contains("drag_loop"))
    }

    func testUnavailablePetIsNotDisplayableOnDesktopEvenWithIdleLoop() throws {
        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-16T08:00:00.000Z",
          "pets": [
            {
              "id": "pet_white",
              "petNumber": "CAT-20260616-0002",
              "ownerUserId": "user_demo",
              "currentHostUserId": "friend_1",
              "name": "雪球",
              "type": "cat",
              "ownership": "away",
              "displayState": "unavailable",
              "avatarUrl": null,
              "materials": [
                {
                  "slot": "idle_loop",
                  "name": "待机循环",
                  "videoUrl": "https://example.com/idle.mp4",
                  "status": "ready"
                }
              ]
            }
          ]
        }
        """

        let bundle = try JSONDecoder.desktopPetSync.decode(
            DesktopPetBundle.self,
            from: Data(json.utf8)
        )

        XCTAssertEqual(bundle.pets.first?.hasIdleLoopMaterial, true)
        XCTAssertEqual(bundle.pets.first?.isDisplayableOnDesktop, false)
    }

    func testBundleDescribesLocalVideosThatWouldBeReplacedBySync() throws {
        let suiteName = "DesktopPetSyncClientTests.overwrite.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }

        let localVideoURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("local-idle-\(UUID().uuidString).mp4")
        FileManager.default.createFile(atPath: localVideoURL.path, contents: Data([0x00]))

        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.saveVideoURL(localVideoURL, for: .idleLoop, petIndex: 0)

        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-22T08:00:00.000Z",
          "pets": [
            {
              "id": "pet_orange",
              "name": "栗子",
              "type": "cat",
              "displayState": "active",
              "avatarUrl": null,
              "materials": [
                {
                  "slot": "idle_loop",
                  "name": "待机循环",
                  "videoUrl": "https://example.com/idle.mp4",
                  "status": "ready"
                }
              ]
            }
          ]
        }
        """

        let bundle = try JSONDecoder.desktopPetSync.decode(DesktopPetBundle.self, from: Data(json.utf8))
        let replacements = bundle.localMaterialReplacementDescriptions(settingsStore: settingsStore)

        XCTAssertEqual(replacements, ["栗子 · 待机循环"])
    }

    func testFetchBundleSendsBearerToken() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer desktop-token")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = Data(
                """
                {
                  "version": 1,
                  "generatedAt": "2026-06-16T08:00:00.000Z",
                  "pets": []
                }
                """.utf8
            )

            return (response, data)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: session
        )
        let bundle = try await client.fetchBundle(accessToken: "desktop-token")

        XCTAssertEqual(bundle.version, 1)
    }

    func testFetchBundleReportsSessionExpiredOnUnauthorized() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer expired-token")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 401,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = Data(#"{"error":"DESKTOP_AUTH_REQUIRED"}"#.utf8)

            return (response, data)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: session
        )

        do {
            _ = try await client.fetchBundle(accessToken: "expired-token")
            XCTFail("Expected sessionExpired error")
        } catch let error as DesktopPetSyncError {
            XCTAssertEqual(error, .sessionExpired)
            XCTAssertEqual(error.localizedDescription, "登录已过期，请重新登录。")
        }
    }

    func testFetchBundleReportsReadableTimeout() async throws {
        URLProtocolStub.requestHandler = { _ in
            throw URLError(.timedOut)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: session
        )

        do {
            _ = try await client.fetchBundle(accessToken: "desktop-token")
            XCTFail("Expected requestTimedOut error")
        } catch {
            XCTAssertEqual(error.localizedDescription, "同步链接响应超时，请稍后重试或重新登录。")
        }
    }

    @MainActor
    func testImportBundleReportsReadableTimeoutForMaterialDownload() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://example.com/idle.mp4")
            throw URLError(.timedOut)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: session
        )
        let bundle = try JSONDecoder.desktopPetSync.decode(
            DesktopPetBundle.self,
            from: Data(
                """
                {
                  "version": 1,
                  "generatedAt": "2026-06-24T08:00:00.000Z",
                  "pets": [
                    {
                      "id": "pet_orange",
                      "petNumber": "CAT-20260624-0001",
                      "ownerUserId": "user_demo",
                      "currentHostUserId": "user_demo",
                      "name": "栗子",
                      "type": "cat",
                      "ownership": "owned",
                      "displayState": "active",
                      "avatarUrl": null,
                      "materials": [
                        {
                          "slot": "idle_loop",
                          "name": "待机循环",
                          "videoUrl": "https://example.com/idle.mp4",
                          "status": "ready"
                        }
                      ]
                    }
                  ]
                }
                """.utf8
            )
        )
        let suiteName = "DesktopPetSyncClientTests.timeout.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let settingsStore = SettingsStore(defaults: defaults)
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        do {
            _ = try await client.importBundle(
                bundle,
                settingsStore: settingsStore,
                petColonyController: petColonyController
            )
            XCTFail("Expected requestTimedOut error")
        } catch {
            XCTAssertEqual(error.localizedDescription, "同步链接响应超时，请稍后重试或重新登录。")
        }
    }

    @MainActor
    func testImportBundleKeepsDesktopPetWhenOptionalMaterialDownloadFails() async throws {
        URLProtocolStub.requestHandler = { request in
            if request.url?.absoluteString == "https://example.com/click.mp4" {
                throw URLError(.timedOut)
            }

            XCTAssertEqual(request.url?.absoluteString, "https://example.com/idle.mp4")
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "video/mp4"]
            )!

            return (response, Data("idle-video".utf8))
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let remoteMaterialRootURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("DesktopPetSyncClientTests.optional.\(UUID().uuidString)", isDirectory: true)
        defer {
            try? FileManager.default.removeItem(at: remoteMaterialRootURL)
        }
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: session,
            remoteMaterialRootURL: remoteMaterialRootURL
        )
        let bundle = DesktopPetBundle(
            version: 1,
            generatedAt: "2026-06-25T08:00:00.000Z",
            account: nil,
            sync: nil,
            pets: [
                DesktopPetBundlePet(
                    id: "pet_optional_\(UUID().uuidString)",
                    petNumber: "CAT-OPTIONAL",
                    ownerUserId: "user_demo",
                    ownerName: nil,
                    ownerEmail: nil,
                    currentHostUserId: "user_demo",
                    name: "栗子",
                    type: "cat",
                    ownership: "owned",
                    displayState: "active",
                    avatarUrl: nil,
                    materials: [
                        DesktopPetBundleMaterial(
                            slot: .idleLoop,
                            name: "待机循环",
                            videoUrl: URL(string: "https://example.com/idle.mp4")!,
                            status: "ready"
                        ),
                        DesktopPetBundleMaterial(
                            slot: .clickReact,
                            name: "点击反应",
                            videoUrl: URL(string: "https://example.com/click.mp4")!,
                            status: "ready"
                        )
                    ]
                )
            ]
        )
        let suiteName = "DesktopPetSyncClientTests.optional.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let settingsStore = SettingsStore(defaults: defaults)
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        let summary = try await client.importBundle(
            bundle,
            settingsStore: settingsStore,
            petColonyController: petColonyController
        )

        XCTAssertEqual(summary.petCount, 1)
        XCTAssertEqual(summary.materialCount, 1)
        XCTAssertEqual(settingsStore.petCount, 1)
        XCTAssertTrue(settingsStore.isPetVisible)
        XCTAssertNotNil(settingsStore.restoreVideoURL(for: .idleLoop, petIndex: 0))
        XCTAssertNil(settingsStore.restoreVideoURL(for: .clickReact, petIndex: 0))
    }

    func testImportBundleReusesCachedMaterialWhenURLMetadataMatches() async throws {
        let petID = "pet_cache_\(UUID().uuidString)"
        let materialURL = URL(string: "https://example.com/idle.mp4")!
        let cacheRootURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("DesktopPetSyncClientTests.cache.\(UUID().uuidString)", isDirectory: true)
        let directoryURL = cacheRootURL
            .appendingPathComponent(petID, isDirectory: true)
        let destinationURL = directoryURL
            .appendingPathComponent("idle_loop", isDirectory: false)
            .appendingPathExtension("mp4")
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try Data("cached-video".utf8).write(to: destinationURL)
        try Data(materialURL.absoluteString.utf8).write(to: destinationURL.appendingPathExtension("url"))
        defer {
            try? FileManager.default.removeItem(at: cacheRootURL)
        }

        URLProtocolStub.requestHandler = { _ in
            XCTFail("Expected cached material to be reused without downloading.")
            throw URLError(.badServerResponse)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: URLSession(configuration: configuration),
            remoteMaterialRootURL: cacheRootURL
        )
        let bundle = DesktopPetBundle(
            version: 1,
            generatedAt: "2026-06-25T08:00:00.000Z",
            account: nil,
            sync: nil,
            pets: [
                DesktopPetBundlePet(
                    id: petID,
                    petNumber: "CAT-CACHE",
                    ownerUserId: "user_demo",
                    ownerName: nil,
                    ownerEmail: nil,
                    currentHostUserId: "user_demo",
                    name: "缓存猫",
                    type: "cat",
                    ownership: "owned",
                    displayState: "active",
                    avatarUrl: nil,
                    materials: [
                        DesktopPetBundleMaterial(
                            slot: .idleLoop,
                            name: "待机循环",
                            videoUrl: materialURL,
                            status: "ready"
                        )
                    ]
                )
            ]
        )
        let suiteName = "DesktopPetSyncClientTests.cache.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let settingsStore = SettingsStore(defaults: defaults)
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        let summary = try await client.importBundle(
            bundle,
            settingsStore: settingsStore,
            petColonyController: petColonyController
        )

        XCTAssertEqual(summary.petCount, 1)
        XCTAssertEqual(summary.materialCount, 1)
        let restoredURL = try XCTUnwrap(settingsStore.restoreVideoURL(for: .idleLoop, petIndex: 0))
        XCTAssertEqual(restoredURL.lastPathComponent, destinationURL.lastPathComponent)
        XCTAssertEqual(try Data(contentsOf: restoredURL), Data("cached-video".utf8))
    }

    func testImportBundleHidesOldDesktopPetsWhenBundleHasNoDisplayablePets() async throws {
        URLProtocolStub.requestHandler = { _ in
            XCTFail("Unavailable pets should not download materials.")
            throw URLError(.badServerResponse)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let client = DesktopPetSyncClient(
            endpointURL: URL(string: "https://example.com/api/desktop/pets")!,
            session: URLSession(configuration: configuration)
        )
        let bundle = DesktopPetBundle(
            version: 1,
            generatedAt: "2026-06-25T08:00:00.000Z",
            account: nil,
            sync: nil,
            pets: [
                DesktopPetBundlePet(
                    id: "pet_orange",
                    petNumber: "CAT-OWNER",
                    ownerUserId: "user_demo",
                    ownerName: nil,
                    ownerEmail: nil,
                    currentHostUserId: "friend_1",
                    name: "栗子",
                    type: "cat",
                    ownership: "away",
                    displayState: "unavailable",
                    avatarUrl: nil,
                    materials: [
                        DesktopPetBundleMaterial(
                            slot: .idleLoop,
                            name: "待机循环",
                            videoUrl: URL(string: "https://example.com/idle.mp4")!,
                            status: "ready"
                        )
                    ]
                )
            ]
        )
        let suiteName = "DesktopPetSyncClientTests.hidden.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defer {
            defaults.removePersistentDomain(forName: suiteName)
        }
        let settingsStore = SettingsStore(defaults: defaults)
        settingsStore.petCount = 1
        settingsStore.isPetVisible = true
        let petColonyController = PetColonyController(settingsStore: settingsStore)

        let summary = try await client.importBundle(
            bundle,
            settingsStore: settingsStore,
            petColonyController: petColonyController
        )

        XCTAssertEqual(summary.petCount, 0)
        XCTAssertEqual(summary.materialCount, 0)
        XCTAssertEqual(settingsStore.petCount, 0)
        XCTAssertFalse(settingsStore.isPetVisible)
    }

    func testDesktopSyncClientDoesNotExposePausedFriendAndHostingEndpoints() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/CatDesktopPet/DesktopPetSyncClient.swift")
        let source = try String(contentsOf: sourceURL)

        for removedSymbol in [
            "DesktopFriend",
            "DesktopHosting",
            "fetchFriends",
            "addFriend",
            "removeFriend",
            "fetchHostingRequests",
            "requestHosting",
            "updateHostingRequest",
            "recallPet"
        ] {
            XCTAssertFalse(source.contains(removedSymbol), "\(removedSymbol) should stay paused on Mac desktop")
        }
    }

    func testDefaultLoginURLUsesProductionAlias() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(
                request.url?.absoluteString,
                "https://web-guoyaowens-projects.vercel.app/api/desktop/auth/login"
            )
            XCTAssertEqual(request.httpMethod, "POST")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = Data(
                """
                {
                  "mode": "supabase",
                  "tokenType": "bearer",
                  "accessToken": "desktop-token",
                  "expiresIn": 3600,
                  "account": {
                    "id": "user_demo",
                    "name": "栗子主人",
                    "email": "demo@desktop.pet",
                    "credits": 120
                  }
                }
                """.utf8
            )

            return (response, data)
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [URLProtocolStub.self]
        let session = URLSession(configuration: configuration)
        let client = DesktopPetSyncClient(session: session)
        let login = try await client.login(email: "demo@desktop.pet", password: "123456")

        XCTAssertEqual(login.accessToken, "desktop-token")
        XCTAssertEqual(login.account.email, "demo@desktop.pet")
    }
}

private final class URLProtocolStub: URLProtocol {
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

private func bodyData(for request: URLRequest) -> Data? {
    if let httpBody = request.httpBody {
        return httpBody
    }

    guard let stream = request.httpBodyStream else {
        return nil
    }

    stream.open()
    defer {
        stream.close()
    }

    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 1024)

    while stream.hasBytesAvailable {
        let count = stream.read(&buffer, maxLength: buffer.count)

        if count <= 0 {
            break
        }

        data.append(buffer, count: count)
    }

    return data
}
