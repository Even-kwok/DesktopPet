import AppKit
import Foundation

enum RemoteImageLoadingError: LocalizedError, Equatable {
    case httpStatus(Int)
    case invalidImageData

    var errorDescription: String? {
        switch self {
        case .httpStatus(let statusCode):
            "头像图片请求失败，HTTP \(statusCode)。"
        case .invalidImageData:
            "头像图片数据无法解析。"
        }
    }
}

struct RemoteImageLoader {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func loadImage(from url: URL) async throws -> NSImage {
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("image/*,*/*;q=0.8", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        if let httpResponse = response as? HTTPURLResponse,
           !(200..<300).contains(httpResponse.statusCode) {
            throw RemoteImageLoadingError.httpStatus(httpResponse.statusCode)
        }

        guard let image = NSImage(data: data) else {
            throw RemoteImageLoadingError.invalidImageData
        }

        return image
    }
}
