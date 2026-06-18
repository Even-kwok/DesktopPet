import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var settingsStore: SettingsStore?
    private var petColonyController: PetColonyController?
    private var statusBarController: StatusBarController?
    private var petStudioWindowController: PetStudioWindowController?
    private var sleepRecoveryCoordinator: DesktopSleepRecoveryCoordinator?

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
        sleepRecoveryCoordinator = DesktopSleepRecoveryCoordinator(
            prepareForSleep: { [weak petColonyController] in
                petColonyController?.prepareForSystemSleep()
            },
            resumeAfterWake: { [weak petColonyController, weak statusBarController] in
                petColonyController?.resumeAfterSystemWake()
                statusBarController?.refreshMenu()
            }
        )
        registerSleepWakeNotifications()

        statusBarController.start(showsFirstRunPrompt: false)
        petStudioWindowController.show()
    }

    deinit {
        NSWorkspace.shared.notificationCenter.removeObserver(self)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        petColonyController?.resumeAfterSystemWake()
        statusBarController?.handleDockReopen()
        return false
    }

    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        statusBarController?.makeDockMenu()
    }

    private func registerSleepWakeNotifications() {
        let notificationCenter = NSWorkspace.shared.notificationCenter
        notificationCenter.addObserver(
            self,
            selector: #selector(handleSystemWillSleep),
            name: NSWorkspace.willSleepNotification,
            object: nil
        )
        notificationCenter.addObserver(
            self,
            selector: #selector(handleSystemDidWake),
            name: NSWorkspace.didWakeNotification,
            object: nil
        )
    }

    @objc private func handleSystemWillSleep(_ notification: Notification) {
        sleepRecoveryCoordinator?.systemWillSleep()
    }

    @objc private func handleSystemDidWake(_ notification: Notification) {
        sleepRecoveryCoordinator?.systemDidWake()
    }
}
