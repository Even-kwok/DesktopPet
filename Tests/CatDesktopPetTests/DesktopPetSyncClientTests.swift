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

    func testFetchFriendsUsesApiBaseAndBearerToken() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://example.com/api/friends")
            XCTAssertEqual(request.httpMethod, "GET")
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
                  "friends": [
                    {
                      "id": "friend_1",
                      "name": "Mika",
                      "status": "离线",
                      "hostedPets": 0
                    }
                  ]
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
        let friends = try await client.fetchFriends(accessToken: "desktop-token")

        XCTAssertEqual(friends.first?.id, "friend_1")
        XCTAssertEqual(friends.first?.name, "Mika")
        XCTAssertEqual(friends.first?.isOnline, false)
    }

    func testAddFriendPostsEmailToFriendsApi() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://example.com/api/friends")
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer desktop-token")

            let body = try XCTUnwrap(bodyData(for: request))
            let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
            XCTAssertEqual(payload["email"], "mika@desktop.pet")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = Data(
                """
                {
                  "friend": {
                    "id": "friend_1",
                    "name": "Mika",
                    "status": "离线",
                    "hostedPets": 0
                  }
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
        let friend = try await client.addFriend(
            email: "mika@desktop.pet",
            accessToken: "desktop-token"
        )

        XCTAssertEqual(friend.id, "friend_1")
    }

    func testRemoveFriendSendsDeleteBodyToFriendsApi() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.url?.absoluteString, "https://example.com/api/friends")
            XCTAssertEqual(request.httpMethod, "DELETE")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer desktop-token")

            let body = try XCTUnwrap(bodyData(for: request))
            let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
            XCTAssertEqual(payload["friendId"], "friend_1")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let data = Data(
                """
                {
                  "deletedFriendId": "friend_1"
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
        let result = try await client.removeFriend(
            friendID: "friend_1",
            accessToken: "desktop-token"
        )

        XCTAssertEqual(result.deletedFriendId, "friend_1")
    }

    func testDefaultLoginURLUsesProductionAlias() async throws {
        URLProtocolStub.requestHandler = { request in
            XCTAssertEqual(
                request.url?.absoluteString,
                "https://web-six-inky-07atkspz3h.vercel.app/api/desktop/auth/login"
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
