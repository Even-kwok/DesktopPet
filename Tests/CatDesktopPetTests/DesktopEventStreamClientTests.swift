import XCTest
@testable import CatDesktopPet

final class DesktopEventStreamClientTests: XCTestCase {
    func testParsesCompleteDesktopEventFrames() throws {
        let parser = DesktopEventStreamParser()
        let events = parser.append([
            "event: hosting_request_created",
            #"data: {"id":"event_1","userId":"receiver","type":"hosting_request_created","petId":"pet_orange","hostingRequestId":"hosting_1","createdAt":"2026-06-25T08:00:00.000Z"}"#,
            "",
            ""
        ].joined(separator: "\n"))

        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.id, "event_1")
        XCTAssertEqual(events.first?.type, "hosting_request_created")
        XCTAssertEqual(events.first?.petId, "pet_orange")
        XCTAssertEqual(events.first?.hostingRequestId, "hosting_1")
    }

    func testKeepsPartialFramesUntilNextChunk() throws {
        let parser = DesktopEventStreamParser()

        XCTAssertTrue(parser.append("event: pet_recalled\n").isEmpty)

        let events = parser.append([
            #"data: {"id":"event_2","userId":"owner","type":"pet_recalled","createdAt":"2026-06-25T08:00:00.000Z"}"#,
            "",
            ""
        ].joined(separator: "\n"))

        XCTAssertEqual(events.map(\.id), ["event_2"])
        XCTAssertEqual(events.map(\.type), ["pet_recalled"])
    }

    func testIgnoresCommentsRetryFramesAndMalformedData() throws {
        let parser = DesktopEventStreamParser()
        let events = parser.append([
            ": heartbeat",
            "",
            "retry: 3000",
            "",
            "event: hosting_request_created",
            #"data: {"id":"event_3","userId":"receiver","type":"hosting_request_declined","createdAt":"2026-06-25T08:00:00.000Z"}"#,
            "",
            "event: hosting_request_declined",
            "data: not-json",
            "",
            ""
        ].joined(separator: "\n"))

        XCTAssertTrue(events.isEmpty)
    }

    func testMapsDesktopEventsToClientActions() {
        XCTAssertNil(desktopEventAction(for: "hosting_request_created"))
        XCTAssertNil(desktopEventAction(for: "hosting_request_declined"))
        XCTAssertEqual(desktopEventAction(for: "hosting_request_accepted"), .syncDesktopBundle)
        XCTAssertEqual(desktopEventAction(for: "pet_recalled"), .syncDesktopBundle)
        XCTAssertEqual(desktopEventAction(for: "desktop_bundle_changed"), .syncDesktopBundle)
        XCTAssertNil(desktopEventAction(for: "unknown"))
    }
}
