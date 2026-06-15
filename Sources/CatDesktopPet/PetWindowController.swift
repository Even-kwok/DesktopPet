import AppKit

final class PetWindowController: NSObject, NSWindowDelegate {
    private let settingsStore: SettingsStore
    private let stateMachine: PetStateMachine
    private let petIndex: Int
    private var panel: PetPanel?
    private var petView: PetView?
    private var mouseMonitorTimer: Timer?
    private var sleepTimer: Timer?
    private var idleActionTimer: Timer?
    private var pendingSocialInteractionSlots: [PetActionSlot]?
    private var wasMouseInsideCatchFrame = false
    private let idleSleepDelay: TimeInterval = 60
    private let idleActionDelayRange: ClosedRange<TimeInterval> = 12...28

    init(settingsStore: SettingsStore, stateMachine: PetStateMachine, petIndex: Int) {
        self.settingsStore = settingsStore
        self.stateMachine = stateMachine
        self.petIndex = petIndex
        super.init()

        stateMachine.onStateChanged = { [weak self] state in
            self?.apply(state: state)
        }
    }

    var isVisible: Bool {
        panel?.isVisible == true
    }

    var frame: NSRect? {
        panel?.frame
    }

    @discardableResult
    func show() -> Bool {
        guard let url = settingsStore.restoreVideoURL(for: .idleLoop, petIndex: petIndex) else {
            hide()
            return false
        }

        show(videoURL: url)
        return true
    }

    private func show(videoURL: URL) {
        let panel = panel ?? createPanel()
        let petView = petView ?? createPetView(in: panel)

        panel.ignoresMouseEvents = settingsStore.isClickThrough
        petView.videoPlayerView.loadVideo(from: videoURL, mode: .loop)
        petView.videoPlayerView.play()
        panel.orderFrontRegardless()
        stateMachine.send(.show)
    }

    func hide() {
        petView?.videoPlayerView.pause()
        panel?.orderOut(nil)
        stateMachine.send(.hide)
    }

    func refreshPlayback() {
        guard isVisible else {
            return
        }

        apply(state: stateMachine.state)
    }

    func bringToFront() {
        panel?.orderFrontRegardless()
    }

    func refreshDisplayName() {
        panel?.title = panelTitle
    }

    func setClickThrough(_ isClickThrough: Bool) {
        panel?.ignoresMouseEvents = isClickThrough
    }

    func resetPosition() {
        let frame = SettingsStore.defaultPetFrame(for: petIndex)
        settingsStore.setPetFrame(frame, for: petIndex)
        panel?.setFrame(frame, display: true)
    }

    @discardableResult
    func triggerNearbyPetInteraction(from side: PetInteractionSide) -> Bool {
        let slots = PetActionSlot.nearbyPetInteractionSlots(for: side)
        guard let slot = randomAvailableSlot(from: slots) else {
            return false
        }

        return triggerNearbyPetInteraction(slot: slot)
    }

    func randomNearbyPetInteractionSlot(from side: PetInteractionSide) -> PetActionSlot? {
        randomAvailableSlot(from: PetActionSlot.nearbyPetInteractionSlots(for: side))
    }

    @discardableResult
    func triggerNearbyPetInteraction(slot: PetActionSlot) -> Bool {
        guard stateMachine.state == .idle,
              settingsStore.hasVideo(for: slot, petIndex: petIndex) else {
            return false
        }

        pendingSocialInteractionSlots = [slot]
        stateMachine.send(.nearbyPet)
        return true
    }

    private func createPanel() -> PetPanel {
        let panel = PetPanel(
            contentRect: settingsStore.petFrame(for: petIndex),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        panel.delegate = self
        panel.title = panelTitle
        panel.isFloatingPanel = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = false
        panel.ignoresMouseEvents = settingsStore.isClickThrough

        self.panel = panel
        return panel
    }

    private var panelTitle: String {
        "CatDesktopPet - \(settingsStore.petName(for: petIndex))"
    }

    private func createPetView(in panel: NSPanel) -> PetView {
        let petView = PetView(frame: panel.contentView?.bounds ?? .zero)
        petView.autoresizingMask = [.width, .height]
        petView.delegate = self

        panel.contentView = petView
        self.petView = petView
        return petView
    }

    private func apply(state: PetState) {
        switch state {
        case .hidden:
            stopMouseMonitor()
            stopSleepTimer()
            stopIdleActionTimer()
            petView?.setGrabbedAppearance(false)
        case .idle:
            petView?.setGrabbedAppearance(false)
            playIdleVideo()
            scheduleSleepTimer()
            scheduleIdleActionTimer()
        case .sleeping:
            stopSleepTimer()
            stopIdleActionTimer()
            petView?.setGrabbedAppearance(false)
            playSleepVideo()
            startMouseMonitor()
        case .clicked:
            stopSleepTimer()
            stopIdleActionTimer()
            playClickReaction()
        case .catchingBug:
            stopSleepTimer()
            stopIdleActionTimer()
            playCatchBugReaction()
        case .idleAction:
            stopSleepTimer()
            stopIdleActionTimer()
            playIdleRandomAction()
        case .socialInteraction:
            stopSleepTimer()
            stopIdleActionTimer()
            playSocialInteraction()
        case .grabbed:
            stopMouseMonitor()
            stopSleepTimer()
            stopIdleActionTimer()
            pendingSocialInteractionSlots = nil
            petView?.setGrabbedAppearance(true)
            playVideo(for: .dragLoop, fallback: .idleLoop, mode: .loop)
        case .dropped:
            stopMouseMonitor()
            stopSleepTimer()
            stopIdleActionTimer()
            pendingSocialInteractionSlots = nil
            petView?.setGrabbedAppearance(false)
            petView?.playDropBounce()
        }
    }

    func windowDidMove(_ notification: Notification) {
        saveFrame()
    }

    func windowDidResize(_ notification: Notification) {
        saveFrame()
    }

    private func saveFrame() {
        guard let panel else {
            return
        }

        settingsStore.setPetFrame(panel.frame, for: petIndex)
    }

    private func playClickReaction() {
        playRandomOneShotAction(from: PetActionSlot.clickReactionSlots)
    }

    private func playCatchBugReaction() {
        playRandomOneShotAction(from: PetActionSlot.mouseoverCatchSlots)
    }

    private func playIdleRandomAction() {
        playRandomOneShotAction(from: PetActionSlot.idleRandomActionSlots)
    }

    private func playSocialInteraction() {
        let slots = pendingSocialInteractionSlots ?? []
        pendingSocialInteractionSlots = nil
        playRandomOneShotAction(from: slots)
    }

    private func playRandomOneShotAction(from slots: [PetActionSlot]) {
        guard let slot = randomAvailableSlot(from: slots),
              let url = settingsStore.restoreVideoURL(for: slot, petIndex: petIndex) else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in
                self?.stateMachine.send(.reactionFinished)
            }
            return
        }

        petView?.videoPlayerView.loadVideo(from: url, mode: .playOnce) { [weak self] in
            self?.stateMachine.send(.reactionFinished)
        }
        petView?.videoPlayerView.play()
    }

    private func playIdleVideo() {
        playVideo(for: .idleLoop, mode: .loop)
        startMouseMonitorIfNeeded()
    }

    private func playSleepVideo() {
        guard settingsStore.hasVideo(for: .sleepLoop, petIndex: petIndex) else {
            stateMachine.send(.wake)
            return
        }

        playVideo(for: .sleepLoop, mode: .playOnce)
    }

    private func playVideo(
        for slot: PetActionSlot,
        fallback fallbackSlot: PetActionSlot? = nil,
        mode: VideoPlaybackMode
    ) {
        let url = settingsStore.restoreVideoURL(for: slot, petIndex: petIndex)
            ?? fallbackSlot.flatMap { settingsStore.restoreVideoURL(for: $0, petIndex: petIndex) }

        guard let url else {
            return
        }

        petView?.videoPlayerView.loadVideo(from: url, mode: mode)
        petView?.videoPlayerView.play()
    }

    private func startMouseMonitorIfNeeded() {
        guard settingsStore.hasVideo(for: .sleepLoop, petIndex: petIndex)
            || (settingsStore.isMouseoverCatchEnabled && hasAvailableSlot(in: PetActionSlot.mouseoverCatchSlots)) else {
            stopMouseMonitor()
            return
        }

        startMouseMonitor()
    }

    private func startMouseMonitor() {
        guard mouseMonitorTimer == nil else {
            return
        }

        if let panel {
            wasMouseInsideCatchFrame = mouseoverCatchFrame(around: panel.frame).contains(NSEvent.mouseLocation)
        }

        let timer = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            self?.updateMouseMonitor()
        }
        RunLoop.main.add(timer, forMode: .common)
        mouseMonitorTimer = timer
    }

    private func stopMouseMonitor() {
        mouseMonitorTimer?.invalidate()
        mouseMonitorTimer = nil
        wasMouseInsideCatchFrame = false
    }

    private func scheduleSleepTimer() {
        stopSleepTimer()

        guard settingsStore.hasVideo(for: .sleepLoop, petIndex: petIndex) else {
            return
        }

        let timer = Timer(timeInterval: idleSleepDelay, repeats: false) { [weak self] _ in
            self?.tryEnterSleep()
        }
        RunLoop.main.add(timer, forMode: .common)
        sleepTimer = timer
    }

    private func stopSleepTimer() {
        sleepTimer?.invalidate()
        sleepTimer = nil
    }

    private func scheduleIdleActionTimer() {
        stopIdleActionTimer()

        guard hasAvailableSlot(in: PetActionSlot.idleRandomActionSlots) else {
            return
        }

        let timer = Timer(timeInterval: TimeInterval.random(in: idleActionDelayRange), repeats: false) { [weak self] _ in
            self?.tryPlayIdleRandomAction()
        }
        RunLoop.main.add(timer, forMode: .common)
        idleActionTimer = timer
    }

    private func stopIdleActionTimer() {
        idleActionTimer?.invalidate()
        idleActionTimer = nil
    }

    private func tryPlayIdleRandomAction() {
        idleActionTimer = nil

        guard stateMachine.state == .idle,
              hasAvailableSlot(in: PetActionSlot.idleRandomActionSlots),
              let panel,
              panel.isVisible else {
            return
        }

        if isMouseNearPet(NSEvent.mouseLocation, frame: panel.frame, margin: 35) {
            scheduleIdleActionTimer()
            return
        }

        stateMachine.send(.idleActionDue)
    }

    private func tryEnterSleep() {
        sleepTimer = nil

        guard stateMachine.state == .idle,
              settingsStore.hasVideo(for: .sleepLoop, petIndex: petIndex),
              let panel,
              panel.isVisible else {
            return
        }

        guard !isMouseNearPet(NSEvent.mouseLocation, frame: panel.frame, margin: 70) else {
            scheduleSleepTimer()
            return
        }

        stateMachine.send(.sleep)
    }

    private func updateMouseMonitor() {
        guard let panel,
              panel.isVisible else {
            return
        }

        let mouseLocation = NSEvent.mouseLocation

        if stateMachine.state == .sleeping {
            if isMouseNearPet(mouseLocation, frame: panel.frame, margin: 35) {
                wasMouseInsideCatchFrame = mouseoverCatchFrame(around: panel.frame).contains(mouseLocation)
                stateMachine.send(.wake)
            }

            return
        }

        let isInsideCatchFrame = mouseoverCatchFrame(around: panel.frame).contains(mouseLocation)

        guard isInsideCatchFrame else {
            wasMouseInsideCatchFrame = false
            return
        }

        guard !wasMouseInsideCatchFrame else {
            return
        }

        wasMouseInsideCatchFrame = true

        guard stateMachine.state == .idle,
              settingsStore.isMouseoverCatchEnabled,
              hasAvailableSlot(in: PetActionSlot.mouseoverCatchSlots) else {
            return
        }

        stateMachine.send(.mouseOverPet)
    }

    private func hasAvailableSlot(in slots: [PetActionSlot]) -> Bool {
        randomAvailableSlot(from: slots) != nil
    }

    private func randomAvailableSlot(from slots: [PetActionSlot]) -> PetActionSlot? {
        slots
            .filter { settingsStore.hasVideo(for: $0, petIndex: petIndex) }
            .randomElement()
    }

    private func mouseoverCatchFrame(around frame: NSRect) -> NSRect {
        frame.insetBy(dx: -10, dy: -10)
    }

    private func petProximityFrame(around frame: NSRect, margin: CGFloat) -> NSRect {
        frame.insetBy(dx: -margin, dy: -margin)
    }

    private func isMouseNearPet(_ mouseLocation: NSPoint, frame: NSRect, margin: CGFloat) -> Bool {
        petProximityFrame(around: frame, margin: margin).contains(mouseLocation)
    }
}

extension PetWindowController: PetViewDelegate {
    func petViewDidClick(_ petView: PetView) {
        stateMachine.send(.click)
    }

    func petView(_ petView: PetView, didDragBy delta: NSPoint) {
        guard let panel else {
            return
        }

        var frame = panel.frame
        frame.origin.x += delta.x
        frame.origin.y += delta.y
        panel.setFrame(frame, display: true)
        saveFrame()
    }
}

final class PetPanel: NSPanel {
    override var canBecomeKey: Bool {
        false
    }

    override var canBecomeMain: Bool {
        false
    }
}
