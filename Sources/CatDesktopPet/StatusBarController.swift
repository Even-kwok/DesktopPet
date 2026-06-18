import AppKit
import UniformTypeIdentifiers

final class StatusBarController: NSObject {
    private let settingsStore: SettingsStore
    private let petColonyController: PetColonyController
    private let openStudio: () -> Void
    private let thumbnailProvider = PetThumbnailProvider()
    private var statusItem: NSStatusItem?
    private weak var showHideItem: NSMenuItem?
    private weak var clickThroughItem: NSMenuItem?
    private weak var mouseoverCatchItem: NSMenuItem?

    init(
        settingsStore: SettingsStore,
        petColonyController: PetColonyController,
        openStudio: @escaping () -> Void
    ) {
        self.settingsStore = settingsStore
        self.petColonyController = petColonyController
        self.openStudio = openStudio
        super.init()
    }

    func start(showsFirstRunPrompt: Bool = true) {
        createStatusItem()
        let didRestoreVideo = restorePreviousSession()
        refreshMenu()

        if showsFirstRunPrompt && !didRestoreVideo {
            showFirstRunPrompt()
        }
    }

    private func createStatusItem() {
        let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        self.statusItem = statusItem

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "pawprint.fill", accessibilityDescription: "CatDesktopPet")
            button.image?.isTemplate = true
            button.title = " Pet"
            button.toolTip = "CatDesktopPet"
        }

        statusItem.menu = makeControlMenu(keepsStatusReferences: true)
    }

    func makeDockMenu() -> NSMenu {
        makeControlMenu(keepsStatusReferences: false)
    }

    func handleDockReopen() {
        openStudio()
    }

    private func makeControlMenu(keepsStatusReferences: Bool) -> NSMenu {
        let menu = NSMenu()
        menu.addItem(menuItem(title: "打开素材工作台", action: #selector(openStudioWindow), keyEquivalent: ","))
        menu.addItem(.separator())

        let chooseStateVideoItem = NSMenuItem(title: "选择状态视频", action: nil, keyEquivalent: "")
        chooseStateVideoItem.submenu = makeChooseStateVideoMenu()
        menu.addItem(chooseStateVideoItem)

        let removeStateVideoItem = NSMenuItem(title: "删除状态视频", action: nil, keyEquivalent: "")
        removeStateVideoItem.submenu = makeRemoveStateVideoMenu()
        menu.addItem(removeStateVideoItem)

        let petsItem = NSMenuItem(title: "宠物", action: nil, keyEquivalent: "")
        petsItem.submenu = makePetsMenu()
        menu.addItem(petsItem)

        let showHideItem = menuItem(
            title: petColonyController.isVisible ? "隐藏宠物" : "显示宠物",
            action: #selector(togglePetVisibility),
            keyEquivalent: "s"
        )
        menu.addItem(showHideItem)

        let clickThroughItem = menuItem(title: "切换点击穿透", action: #selector(toggleClickThrough), keyEquivalent: "t")
        clickThroughItem.state = settingsStore.isClickThrough ? .on : .off
        menu.addItem(clickThroughItem)

        let mouseoverCatchItem = menuItem(title: "切换鼠标经过抓虫", action: #selector(toggleMouseoverCatch), keyEquivalent: "w")
        mouseoverCatchItem.state = settingsStore.isMouseoverCatchEnabled ? .on : .off
        menu.addItem(mouseoverCatchItem)

        menu.addItem(menuItem(title: "重置位置", action: #selector(resetPosition), keyEquivalent: "r"))
        menu.addItem(.separator())
        menu.addItem(menuItem(title: "退出", action: #selector(quit), keyEquivalent: "q"))

        if keepsStatusReferences {
            self.showHideItem = showHideItem
            self.clickThroughItem = clickThroughItem
            self.mouseoverCatchItem = mouseoverCatchItem
        }

        return menu
    }

    private func menuItem(title: String, action: Selector, keyEquivalent: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: keyEquivalent)
        item.target = self
        return item
    }

    private func makeChooseStateVideoMenu() -> NSMenu {
        let menu = NSMenu()

        for petIndex in 0..<settingsStore.petCount {
            let item = makePetMenuItem(for: petIndex)
            item.submenu = makeChooseStateVideoMenu(for: petIndex)
            menu.addItem(item)
        }

        return menu
    }

    private func makeChooseStateVideoMenu(for petIndex: Int) -> NSMenu {
        let menu = NSMenu()

        for slot in PetActionSlot.allCases {
            let item = NSMenuItem(
                title: slot.displayName,
                action: #selector(choosePetVideoForSlot(_:)),
                keyEquivalent: petIndex == 0 && slot == .idleLoop ? "o" : ""
            )
            item.target = self
            item.representedObject = slotRepresentation(for: slot, petIndex: petIndex)
            item.state = settingsStore.hasVideo(for: slot, petIndex: petIndex) ? .on : .off
            menu.addItem(item)
        }

        return menu
    }

    private func makeRemoveStateVideoMenu() -> NSMenu {
        let menu = NSMenu()

        for petIndex in 0..<settingsStore.petCount {
            let item = makePetMenuItem(for: petIndex)
            item.submenu = makeRemoveStateVideoMenu(for: petIndex)
            menu.addItem(item)
        }

        return menu
    }

    private func makeRemoveStateVideoMenu(for petIndex: Int) -> NSMenu {
        let menu = NSMenu()

        for slot in PetActionSlot.allCases {
            let hasVideo = settingsStore.hasVideo(for: slot, petIndex: petIndex)
            let item = NSMenuItem(
                title: slot.displayName,
                action: #selector(removePetVideoForSlot(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = slotRepresentation(for: slot, petIndex: petIndex)
            item.isEnabled = hasVideo
            item.state = hasVideo ? .on : .off
            menu.addItem(item)
        }

        return menu
    }

    private func makePetsMenu() -> NSMenu {
        let menu = NSMenu()

        let currentItem = NSMenuItem(title: "当前宠物数：\(settingsStore.petCount)", action: nil, keyEquivalent: "")
        currentItem.isEnabled = false
        menu.addItem(currentItem)
        menu.addItem(.separator())

        menu.addItem(menuItem(title: "添加宠物", action: #selector(addPet), keyEquivalent: "n"))

        let renameItem = NSMenuItem(title: "重命名宠物", action: nil, keyEquivalent: "")
        renameItem.submenu = makeRenamePetMenu()
        renameItem.isEnabled = settingsStore.petCount > 0
        menu.addItem(renameItem)

        let removeItem = NSMenuItem(title: "删除宠物", action: nil, keyEquivalent: "")
        removeItem.submenu = makeRemovePetMenu()
        removeItem.isEnabled = settingsStore.petCount > 0
        menu.addItem(removeItem)

        return menu
    }

    private func makeRemovePetMenu() -> NSMenu {
        let menu = NSMenu()

        for petIndex in 0..<settingsStore.petCount {
            let item = makePetMenuItem(for: petIndex, action: #selector(removePet(_:)))
            menu.addItem(item)
        }

        return menu
    }

    private func makeRenamePetMenu() -> NSMenu {
        let menu = NSMenu()

        for petIndex in 0..<settingsStore.petCount {
            let item = makePetMenuItem(for: petIndex, action: #selector(renamePet(_:)))
            menu.addItem(item)
        }

        return menu
    }

    @discardableResult
    private func restorePreviousSession() -> Bool {
        petColonyController.setClickThrough(settingsStore.isClickThrough)

        guard settingsStore.isPetVisible else {
            return false
        }

        return petColonyController.showAll()
    }

    private func showFirstRunPrompt() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            guard let self, !self.settingsStore.hasVideo(for: .idleLoop, petIndex: 0) else {
                return
            }

            NSApp.activate(ignoringOtherApps: true)

            let alert = NSAlert()
            alert.messageText = "CatDesktopPet is running"
            alert.informativeText = "请选择一个待机循环绿幕 MP4 或 MOV，宠物才会显示在桌面上。其他状态视频可以稍后从「选择状态视频」里添加。"
            alert.addButton(withTitle: "选择待机循环")
            alert.addButton(withTitle: "稍后")

            if alert.runModal() == .alertFirstButtonReturn {
                self.choosePetVideo(for: .idleLoop, petIndex: 0)
            }
        }
    }

    @objc private func choosePetVideoForSlot(_ sender: NSMenuItem) {
        guard let selection = slotSelection(from: sender) else {
            return
        }

        choosePetVideo(for: selection.slot, petIndex: selection.petIndex)
    }

    private func choosePetVideo(for slot: PetActionSlot, petIndex: Int) {
        NSApp.activate(ignoringOtherApps: true)

        let panel = NSOpenPanel()
        panel.title = "选择 \(settingsStore.petName(for: petIndex)) 的「\(slot.displayName)」视频"
        panel.prompt = "选择"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.mpeg4Movie, .quickTimeMovie, .movie]

        panel.begin { [weak self] response in
            guard let self, response == .OK, let url = panel.url else {
                return
            }

            self.settingsStore.saveVideoURL(url, for: slot, petIndex: petIndex)
            self.thumbnailProvider.invalidate()

            if slot == .idleLoop {
                if self.settingsStore.petCount < petIndex + 1 {
                    self.petColonyController.setPetCount(petIndex + 1)
                }

                self.settingsStore.isPetVisible = true
                self.petColonyController.showAll()
            } else {
                self.petColonyController.refreshPlayback()
            }

            self.refreshMenu()
        }
    }

    @objc private func removePetVideoForSlot(_ sender: NSMenuItem) {
        guard let selection = slotSelection(from: sender) else {
            return
        }

        settingsStore.removeVideo(for: selection.slot, petIndex: selection.petIndex)
        thumbnailProvider.invalidate()

        if selection.slot == .idleLoop, settingsStore.isPetVisible {
            settingsStore.isPetVisible = petColonyController.showAll()
        } else {
            petColonyController.refreshPlayback()
        }

        refreshMenu()
    }

    @objc private func togglePetVisibility() {
        if petColonyController.isVisible {
            petColonyController.hideAll()
            settingsStore.isPetVisible = false
        } else {
            settingsStore.isPetVisible = true

            if !petColonyController.showAll() {
                settingsStore.isPetVisible = false
                choosePetVideo(for: .idleLoop, petIndex: 0)
            }
        }

        refreshMenu()
    }

    @objc private func toggleClickThrough() {
        settingsStore.isClickThrough.toggle()
        petColonyController.setClickThrough(settingsStore.isClickThrough)
        refreshMenu()
    }

    @objc private func toggleMouseoverCatch() {
        settingsStore.isMouseoverCatchEnabled.toggle()
        petColonyController.refreshPlayback()
        refreshMenu()
    }

    @objc private func resetPosition() {
        petColonyController.resetPositions()
        refreshMenu()
    }

    @objc private func addPet() {
        let petIndex = petColonyController.addPet()
        refreshMenu()
        choosePetVideo(for: .idleLoop, petIndex: petIndex)
    }

    @objc private func removePet(_ sender: NSMenuItem) {
        guard let petIndex = sender.representedObject as? Int else {
            return
        }

        let didShowAnyPet = petColonyController.removePet(at: petIndex)
        settingsStore.isPetVisible = settingsStore.isPetVisible && didShowAnyPet
        thumbnailProvider.invalidate()
        refreshMenu()
    }

    @objc private func renamePet(_ sender: NSMenuItem) {
        guard let petIndex = sender.representedObject as? Int else {
            return
        }

        NSApp.activate(ignoringOtherApps: true)

        let textField = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        textField.stringValue = settingsStore.petName(for: petIndex)

        let alert = NSAlert()
        alert.messageText = "重命名宠物"
        alert.informativeText = "给这只宠物起个名字，之后在菜单里更容易分清。"
        alert.accessoryView = textField
        alert.addButton(withTitle: "保存")
        alert.addButton(withTitle: "取消")

        if alert.runModal() == .alertFirstButtonReturn {
            settingsStore.setPetName(textField.stringValue, for: petIndex)
            petColonyController.refreshDisplayNames()
            refreshMenu()
        }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    @objc private func openStudioWindow() {
        openStudio()
    }

    func refreshMenu() {
        statusItem?.menu = makeControlMenu(keepsStatusReferences: true)
    }

    private func makePetMenuItem(
        for petIndex: Int,
        action: Selector? = nil,
        representedObject: Any? = nil
    ) -> NSMenuItem {
        let item = NSMenuItem(
            title: settingsStore.petName(for: petIndex),
            action: action,
            keyEquivalent: ""
        )
        item.target = action == nil ? nil : self
        item.representedObject = representedObject ?? petIndex
        item.image = thumbnailProvider.thumbnail(for: settingsStore.restoreVideoURL(for: .idleLoop, petIndex: petIndex))
        return item
    }

    private func slotRepresentation(for slot: PetActionSlot, petIndex: Int) -> String {
        "\(petIndex)|\(slot.rawValue)"
    }

    private func slotSelection(from sender: NSMenuItem) -> (petIndex: Int, slot: PetActionSlot)? {
        guard let rawValue = sender.representedObject as? String else {
            return nil
        }

        let parts = rawValue.split(separator: "|", maxSplits: 1).map(String.init)
        guard parts.count == 2,
              let petIndex = Int(parts[0]),
              let slot = PetActionSlot(rawValue: parts[1]) else {
            return nil
        }

        return (petIndex, slot)
    }
}
