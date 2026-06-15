import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var settingsStore: SettingsStore?
    private var petColonyController: PetColonyController?
    private var statusBarController: StatusBarController?
    private var petStudioWindowController: PetStudioWindowController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)

        let settingsStore = SettingsStore()
        let petColonyController = PetColonyController(settingsStore: settingsStore)
        var statusBarControllerRef: StatusBarController?
        let petStudioWindowController = PetStudioWindowController(
            settingsStore: settingsStore,
            petColonyController: petColonyController
        ) {
            statusBarControllerRef?.refreshMenu()
        }
        let statusBarController = StatusBarController(
            settingsStore: settingsStore,
            petColonyController: petColonyController
        ) { [weak petStudioWindowController] in
            petStudioWindowController?.show()
        }
        statusBarControllerRef = statusBarController

        self.settingsStore = settingsStore
        self.petColonyController = petColonyController
        self.statusBarController = statusBarController
        self.petStudioWindowController = petStudioWindowController

        statusBarController.start(showsFirstRunPrompt: false)
        petStudioWindowController.show()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        statusBarController?.handleDockReopen()
        return false
    }

    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        statusBarController?.makeDockMenu()
    }
}
