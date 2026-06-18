import Foundation

struct DesktopPetBundle: Decodable {
    let version: Int
    let generatedAt: String
    let account: DesktopSyncAccount?
    let sync: DesktopSyncMetadata?
    let pets: [DesktopPetBundlePet]
}

struct DesktopSyncAccount: Decodable {
    let id: String
    let name: String
    let email: String
    let credits: Int
}

struct DesktopLoginResponse: Decodable {
    let mode: String
    let tokenType: String
    let accessToken: String
    let expiresIn: Int
    let account: DesktopSyncAccount
}

struct DesktopFriendsResponse: Decodable {
    let friends: [DesktopFriendCard]
}

struct DesktopFriendResponse: Decodable {
    let friend: DesktopFriendCard
}

struct DesktopFriendDeleteResponse: Decodable {
    let deletedFriendId: String
}

struct DesktopHostingRequestResponse: Decodable {
    let requestId: String
    let status: String
    let petId: String
    let toUserId: String
}

struct DesktopRecallResponse: Decodable {
    let petId: String
    let status: String
}

struct DesktopSyncMetadata: Decodable {
    let mode: String
    let source: String
    let recommendedPollSeconds: Int
}

struct DesktopPetBundlePet: Decodable {
    let id: String
    let petNumber: String?
    let ownerUserId: String?
    let currentHostUserId: String?
    let name: String
    let type: String
    let ownership: String?
    let displayState: String?
    let avatarUrl: URL?
    let materials: [DesktopPetBundleMaterial]

    var hasIdleLoopMaterial: Bool {
        materials.contains { $0.status == "ready" && $0.slot == .idleLoop }
    }

    var isDisplayableOnDesktop: Bool {
        displayState != "unavailable" && displayState != "hidden" && hasIdleLoopMaterial
    }
}

struct DesktopPetBundleMaterial: Decodable {
    let slot: PetActionSlot
    let name: String
    let videoUrl: URL
    let status: String
}

struct DesktopPetSyncSummary {
    let petCount: Int
    let materialCount: Int
}

enum DesktopPetSyncError: LocalizedError, Equatable {
    case invalidResponse
    case loginFailed
    case sessionExpired
    case emptyBundle
    case missingIdleLoop

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "桌面同步接口返回异常。"
        case .loginFailed:
            "登录失败，请检查账号和密码。"
        case .sessionExpired:
            "登录已过期，请重新登录。"
        case .emptyBundle:
            "网页端还没有可同步的视频素材。"
        case .missingIdleLoop:
            "请先在网页端生成「待机循环」素材，再同步到桌面 App。"
        }
    }
}

extension JSONDecoder {
    static var desktopPetSync: JSONDecoder {
        JSONDecoder()
    }
}

final class DesktopPetSyncClient {
    private static let fallbackWebBaseURL = URL(string: "https://web-six-inky-07atkspz3h.vercel.app")!

    private let endpointURL: URL
    private let apiBaseURL: URL
    private let loginURL: URL
    private let session: URLSession
    private let fileManager: FileManager

    init(
        endpointURL: URL = DesktopPetSyncClient.defaultEndpointURL(),
        loginURL: URL? = nil,
        session: URLSession = .shared,
        fileManager: FileManager = .default
    ) {
        self.endpointURL = endpointURL
        self.apiBaseURL = endpointURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        self.loginURL = loginURL ?? endpointURL
            .deletingLastPathComponent()
            .appendingPathComponent("auth/login")
        self.session = session
        self.fileManager = fileManager
    }

    private static func defaultEndpointURL() -> URL {
        let configuredBaseURL = ProcessInfo.processInfo.environment["CAT_DESKTOP_PET_WEB_BASE_URL"]
            .flatMap { URL(string: $0) } ?? fallbackWebBaseURL

        return configuredBaseURL
            .appendingPathComponent("api")
            .appendingPathComponent("desktop")
            .appendingPathComponent("pets")
    }

    func login(email: String, password: String) async throws -> DesktopLoginResponse {
        var request = URLRequest(url: loginURL)
        request.httpMethod = "POST"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password
        ])

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw DesktopPetSyncError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw DesktopPetSyncError.loginFailed
            }

            throw DesktopPetSyncError.invalidResponse
        }

        return try JSONDecoder.desktopPetSync.decode(DesktopLoginResponse.self, from: data)
    }

    func fetchFriends(accessToken: String) async throws -> [DesktopFriendCard] {
        let response: DesktopFriendsResponse = try await sendAuthorizedJSONRequest(
            pathComponents: ["friends"],
            accessToken: accessToken
        )

        return response.friends
    }

    func addFriend(email: String, accessToken: String) async throws -> DesktopFriendCard {
        let response: DesktopFriendResponse = try await sendAuthorizedJSONRequest(
            pathComponents: ["friends"],
            accessToken: accessToken,
            method: "POST",
            body: ["email": email]
        )

        return response.friend
    }

    func removeFriend(friendID: String, accessToken: String) async throws -> DesktopFriendDeleteResponse {
        try await sendAuthorizedJSONRequest(
            pathComponents: ["friends"],
            accessToken: accessToken,
            method: "DELETE",
            body: ["friendId": friendID]
        )
    }

    func requestHosting(petID: String, toUserID: String, accessToken: String) async throws -> DesktopHostingRequestResponse {
        try await sendAuthorizedJSONRequest(
            pathComponents: ["hosting", "requests"],
            accessToken: accessToken,
            method: "POST",
            body: [
                "petId": petID,
                "toUserId": toUserID
            ]
        )
    }

    func recallPet(petID: String, accessToken: String) async throws -> DesktopRecallResponse {
        try await sendAuthorizedJSONRequest(
            pathComponents: ["hosting", "recall"],
            accessToken: accessToken,
            method: "POST",
            body: ["petId": petID]
        )
    }

    func fetchBundle(accessToken: String? = nil) async throws -> DesktopPetBundle {
        var request = URLRequest(url: endpointURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let accessToken, !accessToken.isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw DesktopPetSyncError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw DesktopPetSyncError.sessionExpired
            }

            throw DesktopPetSyncError.invalidResponse
        }

        return try JSONDecoder.desktopPetSync.decode(DesktopPetBundle.self, from: data)
    }

    private func sendAuthorizedJSONRequest<T: Decodable>(
        pathComponents: [String],
        accessToken: String,
        method: String = "GET",
        body: [String: String]? = nil
    ) async throws -> T {
        let url = pathComponents.reduce(apiBaseURL) { partialURL, component in
            partialURL.appendingPathComponent(component)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw DesktopPetSyncError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if httpResponse.statusCode == 401 {
                throw DesktopPetSyncError.sessionExpired
            }

            throw DesktopPetSyncError.invalidResponse
        }

        return try JSONDecoder.desktopPetSync.decode(T.self, from: data)
    }

    @MainActor
    func importLatestBundle(
        accessToken: String,
        settingsStore: SettingsStore,
        petColonyController: PetColonyController
    ) async throws -> DesktopPetSyncSummary {
        let bundle = try await fetchBundle(accessToken: accessToken)
        return try await importBundle(
            bundle,
            settingsStore: settingsStore,
            petColonyController: petColonyController
        )
    }

    @MainActor
    func importBundle(
        _ bundle: DesktopPetBundle,
        settingsStore: SettingsStore,
        petColonyController: PetColonyController
    ) async throws -> DesktopPetSyncSummary {
        let petsWithMaterials = bundle.pets.filter { !$0.materials.isEmpty }

        guard !petsWithMaterials.isEmpty else {
            throw DesktopPetSyncError.emptyBundle
        }

        let displayablePets = petsWithMaterials.filter(\.isDisplayableOnDesktop)

        guard !displayablePets.isEmpty else {
            throw DesktopPetSyncError.missingIdleLoop
        }

        if settingsStore.petCount < displayablePets.count {
            petColonyController.setPetCount(displayablePets.count)
        }

        var importedMaterialCount = 0

        for (petIndex, pet) in displayablePets.enumerated() {
            settingsStore.setPetName(pet.name, for: petIndex)

            for material in pet.materials where material.status == "ready" {
                let localURL = try await downloadMaterial(material, petID: pet.id)
                settingsStore.saveVideoURL(localURL, for: material.slot, petIndex: petIndex)
                importedMaterialCount += 1
            }
        }

        guard importedMaterialCount > 0 else {
            throw DesktopPetSyncError.emptyBundle
        }

        settingsStore.isPetVisible = true
        petColonyController.refreshDisplayNames()
        petColonyController.showAll()

        return DesktopPetSyncSummary(
            petCount: displayablePets.count,
            materialCount: importedMaterialCount
        )
    }

    private func downloadMaterial(_ material: DesktopPetBundleMaterial, petID: String) async throws -> URL {
        let (temporaryURL, response) = try await session.download(from: material.videoUrl)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw DesktopPetSyncError.invalidResponse
        }

        let directory = try cacheDirectory(for: petID)
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)

        let fileExtension = material.videoUrl.pathExtension.isEmpty
            ? "mp4"
            : material.videoUrl.pathExtension
        let destinationURL = directory
            .appendingPathComponent(material.slot.rawValue, isDirectory: false)
            .appendingPathExtension(fileExtension)

        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }

        try fileManager.moveItem(at: temporaryURL, to: destinationURL)
        return destinationURL
    }

    private func cacheDirectory(for petID: String) throws -> URL {
        let rootURL = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )

        return rootURL
            .appendingPathComponent("CatDesktopPet", isDirectory: true)
            .appendingPathComponent("RemoteMaterials", isDirectory: true)
            .appendingPathComponent(safePathComponent(petID), isDirectory: true)
    }

    private func safePathComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        let scalars = value.unicodeScalars.map { scalar in
            allowed.contains(scalar) ? Character(scalar) : "-"
        }

        let pathComponent = String(scalars)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))

        return pathComponent.isEmpty ? "pet" : pathComponent
    }
}
