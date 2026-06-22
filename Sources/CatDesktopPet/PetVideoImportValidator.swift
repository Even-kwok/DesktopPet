import AVFoundation
import Foundation

struct PetVideoImportMetadata {
    let fileSizeBytes: Int64
    let durationSeconds: Double
    let hasVideoTrack: Bool
}

struct PetVideoImportReview {
    let canImport: Bool
    let blockingMessages: [String]
    let warningMessages: [String]
}

private let maxImportVideoBytes: Int64 = 300 * 1024 * 1024
private let longImportVideoSeconds = 15.0
private let maxImportVideoSeconds = 60.0
private let largeImportVideoBytes: Int64 = 80 * 1024 * 1024

func reviewPetVideoImport(_ metadata: PetVideoImportMetadata) -> PetVideoImportReview {
    var blockingMessages: [String] = []
    var warningMessages: [String] = []

    if !metadata.hasVideoTrack {
        blockingMessages.append("这段视频没有视频画面，请换一个 MP4 或 MOV。")
    }

    if !metadata.durationSeconds.isFinite || metadata.durationSeconds <= 0 {
        blockingMessages.append("这段视频时长异常，请换一个能正常播放的视频。")
    } else if metadata.durationSeconds > maxImportVideoSeconds {
        blockingMessages.append("这段视频太长了，请换 60 秒以内的视频。")
    } else if metadata.durationSeconds > longImportVideoSeconds {
        warningMessages.append("这段视频有点长，作为桌宠动作可能不够轻快。")
    }

    if metadata.fileSizeBytes > maxImportVideoBytes {
        blockingMessages.append("视频有点太大，请换 300MB 以内的视频。")
    } else if metadata.fileSizeBytes > largeImportVideoBytes {
        warningMessages.append("视频有点大，播放和同步可能更慢。")
    }

    return PetVideoImportReview(
        canImport: blockingMessages.isEmpty,
        blockingMessages: blockingMessages,
        warningMessages: warningMessages
    )
}

func inspectPetVideoImport(url: URL) async -> PetVideoImportReview {
    let didStartAccessing = url.startAccessingSecurityScopedResource()
    defer {
        if didStartAccessing {
            url.stopAccessingSecurityScopedResource()
        }
    }

    do {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        let fileSizeBytes = (attributes[.size] as? NSNumber)?.int64Value ?? 0
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        let videoTracks = try await asset.loadTracks(withMediaType: .video)

        return reviewPetVideoImport(
            PetVideoImportMetadata(
                fileSizeBytes: fileSizeBytes,
                durationSeconds: duration.seconds,
                hasVideoTrack: !videoTracks.isEmpty
            )
        )
    } catch {
        return PetVideoImportReview(
            canImport: false,
            blockingMessages: ["视频打不开，请换一个 MP4 或 MOV。"],
            warningMessages: []
        )
    }
}
