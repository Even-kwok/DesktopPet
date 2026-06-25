import Foundation

struct DesktopEvent: Decodable, Equatable {
    let id: String
    let userId: String
    let type: String
    let actorUserId: String?
    let petId: String?
    let hostingRequestId: String?
    let createdAt: String
}

enum DesktopEventStreamAction: Equatable {
    case syncDesktopBundle
}

final class DesktopEventStreamParser {
    private var buffer = ""

    func append(_ chunk: String) -> [DesktopEvent] {
        let combined = "\(buffer)\(chunk)"
            .replacingOccurrences(of: "\r\n", with: "\n")
        var frames = combined.components(separatedBy: "\n\n")
        buffer = frames.popLast() ?? ""

        return frames.compactMap(Self.parseFrame)
    }

    private static func parseFrame(_ frame: String) -> DesktopEvent? {
        var eventName = ""
        var dataLines: [String] = []

        for line in frame.components(separatedBy: "\n") {
            if line.isEmpty || line.hasPrefix(":") {
                continue
            }

            let parts = line.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
            let field = String(parts.first ?? "")
            var value = parts.count > 1 ? String(parts[1]) : ""
            if value.hasPrefix(" ") {
                value.removeFirst()
            }

            if field == "event" {
                eventName = value
            } else if field == "data" {
                dataLines.append(value)
            }
        }

        guard !eventName.isEmpty, !dataLines.isEmpty else {
            return nil
        }

        guard let data = dataLines.joined(separator: "\n").data(using: .utf8),
              let event = try? JSONDecoder.desktopPetSync.decode(DesktopEvent.self, from: data),
              event.type == eventName else {
            return nil
        }

        return event
    }
}

final class DesktopEventStreamClient {
    private let streamURL: URL
    private let accessToken: String
    private let session: URLSession
    private let reconnectDelay: Duration
    private let onEvent: @MainActor (DesktopEvent) async -> Void
    private let onError: @MainActor (Error) -> Void
    private var task: Task<Void, Never>?
    private var cursor: String?

    init(
        streamURL: URL,
        accessToken: String,
        session: URLSession = .shared,
        reconnectDelay: Duration = .seconds(3),
        onEvent: @escaping @MainActor (DesktopEvent) async -> Void,
        onError: @escaping @MainActor (Error) -> Void = { _ in }
    ) {
        self.streamURL = streamURL
        self.accessToken = accessToken
        self.session = session
        self.reconnectDelay = reconnectDelay
        self.onEvent = onEvent
        self.onError = onError
    }

    deinit {
        stop()
    }

    func start(cursor: String? = nil) {
        guard task == nil else {
            return
        }

        self.cursor = cursor
        task = Task { [weak self] in
            await self?.connectLoop()
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    private func connectLoop() async {
        while !Task.isCancelled {
            do {
                try await connectOnce()
            } catch is CancellationError {
                return
            } catch {
                await onError(error)
            }

            if !Task.isCancelled {
                do {
                    try await Task.sleep(for: reconnectDelay)
                } catch {
                    return
                }
            }
        }
    }

    private func connectOnce() async throws {
        var components = URLComponents(url: streamURL, resolvingAgainstBaseURL: false)
        if let cursor, !cursor.isEmpty {
            var queryItems = components?.queryItems ?? []
            queryItems.removeAll { $0.name == "after" }
            queryItems.append(URLQueryItem(name: "after", value: cursor))
            components?.queryItems = queryItems
        }

        guard let url = components?.url else {
            throw DesktopPetSyncError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw DesktopPetSyncError.invalidResponse
        }

        let parser = DesktopEventStreamParser()
        for try await line in bytes.lines {
            try Task.checkCancellation()
            for event in parser.append("\(line)\n") {
                cursor = event.id
                await onEvent(event)
            }
        }
    }
}

func desktopEventAction(for type: String) -> DesktopEventStreamAction? {
    switch type {
    case "hosting_request_accepted", "pet_recalled", "desktop_bundle_changed":
        .syncDesktopBundle
    default:
        nil
    }
}
