import AppKit
import AVFoundation

final class PetThumbnailProvider {
    private let renderer = ChromaKeyRenderer()
    private var cache: [String: NSImage] = [:]
    private let thumbnailSize = NSSize(width: 28, height: 28)

    func thumbnail(for videoURL: URL?) -> NSImage? {
        guard let videoURL else {
            return fallbackThumbnail()
        }

        let didAccessSecurityScope = videoURL.startAccessingSecurityScopedResource()
        defer {
            if didAccessSecurityScope {
                videoURL.stopAccessingSecurityScopedResource()
            }
        }

        let cacheKey = thumbnailCacheKey(for: videoURL)

        if let cachedImage = cache[cacheKey] {
            return cachedImage
        }

        guard let image = makeVideoThumbnail(for: videoURL) else {
            return fallbackThumbnail()
        }

        cache[cacheKey] = image
        return image
    }

    func invalidate() {
        cache.removeAll()
    }

    private func makeVideoThumbnail(for videoURL: URL) -> NSImage? {
        let asset = AVURLAsset(url: videoURL)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: thumbnailSize.width * 3, height: thumbnailSize.height * 3)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = CMTime(seconds: 0.25, preferredTimescale: 600)

        let time = CMTime(seconds: 0.1, preferredTimescale: 600)

        do {
            let cgImage = try generator.copyCGImage(at: time, actualTime: nil)
            let keyedImage = renderer.makeChromaKeyedImage(from: cgImage) ?? cgImage
            let image = NSImage(cgImage: keyedImage, size: thumbnailSize)
            image.isTemplate = false
            return image
        } catch {
            NSLog("Failed to generate pet thumbnail: \(error.localizedDescription)")
            return nil
        }
    }

    private func fallbackThumbnail() -> NSImage? {
        guard let image = NSImage(systemSymbolName: "pawprint.fill", accessibilityDescription: "Pet") else {
            return nil
        }

        image.size = thumbnailSize
        image.isTemplate = true
        return image
    }

    private func thumbnailCacheKey(for videoURL: URL) -> String {
        let modificationDate = try? videoURL.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        let modificationStamp = modificationDate?.timeIntervalSince1970 ?? 0
        return "\(videoURL.path)|\(modificationStamp)"
    }
}
