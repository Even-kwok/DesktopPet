// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "CatDesktopPet",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "CatDesktopPet", targets: ["CatDesktopPet"])
    ],
    targets: [
        .executableTarget(
            name: "CatDesktopPet",
            path: "Sources/CatDesktopPet"
        )
    ]
)
