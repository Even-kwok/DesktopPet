import XCTest
@testable import CatDesktopPet

final class DesktopPetSyncClientTests: XCTestCase {
    func testDecodesDesktopPetBundle() throws {
        let json = """
        {
          "version": 1,
          "generatedAt": "2026-06-16T08:00:00.000Z",
          "pets": [
            {
              "id": "pet_orange",
              "name": "栗子",
              "type": "cat",
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
        XCTAssertEqual(bundle.pets.first?.name, "栗子")
        XCTAssertEqual(bundle.pets.first?.materials.first?.slot, .idleLoop)
        XCTAssertEqual(bundle.pets.first?.hasIdleLoopMaterial, true)
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
}
