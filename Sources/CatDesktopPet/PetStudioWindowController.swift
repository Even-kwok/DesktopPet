import AppKit
import SwiftUI

final class PetStudioWindowController: NSWindowController {
    private let viewModel: PetStudioViewModel

    init(
        settingsStore: SettingsStore,
        petColonyController: PetColonyController,
        onLibraryChanged: @escaping () -> Void
    ) {
        viewModel = PetStudioViewModel(
            settingsStore: settingsStore,
            petColonyController: petColonyController,
            onLibraryChanged: onLibraryChanged
        )

        let hostingController = NSHostingController(rootView: PetStudioView(viewModel: viewModel))
        let window = NSWindow(contentViewController: hostingController)
        window.title = "CatDesktopPet"
        window.styleMask = [.titled, .closable, .miniaturizable, .resizable]
        window.setContentSize(NSSize(width: 560, height: 520))
        window.minSize = NSSize(width: 520, height: 460)
        window.center()

        super.init(window: window)
    }

    required init?(coder: NSCoder) {
        nil
    }

    func show() {
        viewModel.refreshPetList()
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}
