import Foundation

struct DesktopPetBundle: Decodable {
    let version: Int
    let generatedAt: String
    let pets: [DesktopPetBundlePet]
}

struct DesktopPetBundlePet: Decodable {
    let id: String
    let name: String
    let type: String
    let avatarUrl: URL?
    let materials: [DesktopPetBundleMaterial]

    var hasIdleLoopMaterial: Bool {
        materials.contains { $0.status == "ready" && $0.slot == .idleLoop }
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

enum DesktopPetSyncError: LocalizedError {
    case invalidResponse
    case emptyBundle
    case missingIdleLoop

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            "桌面同步接口返回异常。"
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
    private let endpointURL: URL
    private let session: URLSession
    private let fileManager: FileManager

    init(
        endpointURL: URL = URL(string: "https://web-guoyaowens-projects.vercel.app/api/desktop/pets")!,
        session: URLSession = .shared,
        fileManager: FileManager = .default
    ) {
        self.endpointURL = endpointURL
        self.session = session
        self.fileManager = fileManager
    }

    func fetchBundle() async throws -> DesktopPetBundle {
        var request = URLRequest(url: endpointURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw DesktopPetSyncError.invalidResponse
        }

        return try JSONDecoder.desktopPetSync.decode(DesktopPetBundle.self, from: data)
    }

    @MainActor
    func importLatestBundle(
        settingsStore: SettingsStore,
        petColonyController: PetColonyController
    ) async throws -> DesktopPetSyncSummary {
        let bundle = try await fetchBundle()
        let petsWithMaterials = bundle.pets.filter { !$0.materials.isEmpty }

        guard !petsWithMaterials.isEmpty else {
            throw DesktopPetSyncError.emptyBundle
        }

        let displayablePets = petsWithMaterials.filter(\.hasIdleLoopMaterial)

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
