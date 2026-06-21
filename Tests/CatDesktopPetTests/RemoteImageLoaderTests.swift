import Foundation
import XCTest
@testable import CatDesktopPet

final class RemoteImageLoaderTests: XCTestCase {
    override func tearDown() {
        RemoteImageURLProtocolStub.requestHandler = nil
        super.tearDown()
    }

    func testLoadImageBypassesLocalCacheAndDecodesPNG() async throws {
        RemoteImageURLProtocolStub.requestHandler = { request in
            XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
            XCTAssertEqual(request.value(forHTTPHeaderField: "Accept"), "image/*,*/*;q=0.8")

            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "image/png"]
            )!

            return (response, Self.onePixelPNGData)
        }

        let loader = RemoteImageLoader(session: makeStubbedSession())

        let image = try await loader.loadImage(from: URL(string: "https://example.com/avatar.png")!)

        XCTAssertGreaterThan(image.size.width, 0)
        XCTAssertGreaterThan(image.size.height, 0)
    }

    func testLoadImageRejectsHTTPFailures() async throws {
        RemoteImageURLProtocolStub.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 404,
                httpVersion: nil,
                headerFields: ["Content-Type": "text/plain"]
            )!

            return (response, Data("not found".utf8))
        }

        let loader = RemoteImageLoader(session: makeStubbedSession())

        do {
            _ = try await loader.loadImage(from: URL(string: "https://example.com/missing.png")!)
            XCTFail("Expected HTTP failure")
        } catch let error as RemoteImageLoadingError {
            XCTAssertEqual(error, .httpStatus(404))
        }
    }

    private static let onePixelPNGData = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    )!

    private func makeStubbedSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [RemoteImageURLProtocolStub.self]
        return URLSession(configuration: configuration)
    }
}

private final class RemoteImageURLProtocolStub: URLProtocol {
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
