import XCTest
@testable import CatDesktopPet

final class PetVideoImportValidatorTests: XCTestCase {
    func testVideoImportReviewAcceptsNormalShortClips() {
        let review = reviewPetVideoImport(
            PetVideoImportMetadata(
                fileSizeBytes: 12 * 1024 * 1024,
                durationSeconds: 8,
                hasVideoTrack: true
            )
        )

        XCTAssertTrue(review.canImport)
        XCTAssertTrue(review.blockingMessages.isEmpty)
        XCTAssertTrue(review.warningMessages.isEmpty)
    }

    func testVideoImportReviewBlocksFilesWithoutVideoTrack() {
        let review = reviewPetVideoImport(
            PetVideoImportMetadata(
                fileSizeBytes: 3 * 1024 * 1024,
                durationSeconds: 8,
                hasVideoTrack: false
            )
        )

        XCTAssertFalse(review.canImport)
        XCTAssertTrue(review.blockingMessages.joined().contains("视频画面"))
    }

    func testVideoImportReviewWarnsForLongOrLargeClips() {
        let review = reviewPetVideoImport(
            PetVideoImportMetadata(
                fileSizeBytes: 120 * 1024 * 1024,
                durationSeconds: 22,
                hasVideoTrack: true
            )
        )

        XCTAssertTrue(review.canImport)
        XCTAssertTrue(review.warningMessages.joined().contains("有点长"))
        XCTAssertTrue(review.warningMessages.joined().contains("有点大"))
    }
}
