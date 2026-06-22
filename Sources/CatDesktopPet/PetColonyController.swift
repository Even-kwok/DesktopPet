import AppKit

final class PetColonyController {
    private let settingsStore: SettingsStore
    private var petControllers: [PetWindowController] = []
    private var proximityInteractionTimer: Timer?
    private var lastProximityInteractionAt: [Int: Date] = [:]
    private let proximityCheckInterval: TimeInterval = 6.0
    private let proximityInteractionCooldown: TimeInterval = 24.0
    private let proximityInteractionProbability = 0.18
    private let proximityMargin: CGFloat = 28

    init(settingsStore: SettingsStore) {
        self.settingsStore = settingsStore
        ensurePetControllers(upTo: settingsStore.petCount)
    }

    var isVisible: Bool {
        activePetControllers.contains { $0.isVisible }
    }

    var petCount: Int {
        settingsStore.petCount
    }

    func setPetCount(_ count: Int) {
        let newCount = max(count, 0)
        ensurePetControllers(upTo: newCount)
        settingsStore.petCount = newCount

        for controller in inactivePetControllers {
            controller.hide()
        }

        updateProximityInteractionTimer()
        guard settingsStore.isPetVisible else {
            return
        }

        showAll()
    }

    @discardableResult
    func addPet() -> Int {
        let newPetIndex = settingsStore.petCount
        setPetCount(settingsStore.petCount + 1)
        return newPetIndex
    }

    @discardableResult
    func removePet(at index: Int) -> Bool {
        let currentCount = settingsStore.petCount
        guard currentCount > 0, (0..<currentCount).contains(index) else {
            return isVisible
        }

        ensurePetControllers(upTo: currentCount)

        for controller in petControllers.dropFirst(index) {
            controller.hide()
        }

        settingsStore.removePet(at: index)
        lastProximityInteractionAt.removeAll()

        guard settingsStore.isPetVisible else {
            updateProximityInteractionTimer()
            return false
        }

        let didShowAnyPet = showAll()
        updateProximityInteractionTimer()
        return didShowAnyPet
    }

    @discardableResult
    func showAll() -> Bool {
        ensurePetControllers(upTo: settingsStore.petCount)

        var didShowAnyPet = false

        for controller in activePetControllers {
            if controller.show() {
                didShowAnyPet = true
            }
        }

        for controller in inactivePetControllers {
            controller.hide()
        }

        updateProximityInteractionTimer()
        return didShowAnyPet
    }

    func hideAll() {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in petControllers {
            controller.hide()
        }

        stopProximityInteractionTimer()
    }

    func bringToFront() {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in activePetControllers {
            controller.bringToFront()
        }
    }

    func setClickThrough(_ isClickThrough: Bool) {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in petControllers {
            controller.setClickThrough(isClickThrough)
        }
    }

    func setPetSizeScale(_ scale: CGFloat, for petIndex: Int) {
        guard petIndex >= 0, petIndex < settingsStore.petCount else {
            return
        }

        ensurePetControllers(upTo: petIndex + 1)
        petControllers[petIndex].setSizeScale(scale)
        updateProximityInteractionTimer()
    }

    func refreshPlayback() {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in activePetControllers {
            controller.refreshPlayback()
        }
    }

    func prepareForSystemSleep() {
        ensurePetControllers(upTo: settingsStore.petCount)
        stopProximityInteractionTimer()

        for controller in activePetControllers {
            controller.prepareForSystemSleep()
        }
    }

    @discardableResult
    func resumeAfterSystemWake() -> Bool {
        ensurePetControllers(upTo: settingsStore.petCount)

        guard settingsStore.isPetVisible else {
            stopProximityInteractionTimer()
            return false
        }

        let didShowAnyPet = showAll()
        settingsStore.isPetVisible = didShowAnyPet

        for controller in activePetControllers {
            controller.resumeAfterSystemWake()
        }

        updateProximityInteractionTimer()
        return didShowAnyPet
    }

    func refreshDisplayNames() {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in activePetControllers {
            controller.refreshDisplayName()
        }
    }

    func resetPositions() {
        ensurePetControllers(upTo: settingsStore.petCount)

        for controller in activePetControllers {
            controller.resetPosition()
        }
    }

    private func ensurePetControllers(upTo count: Int) {
        guard count > petControllers.count else {
            return
        }

        for index in petControllers.count..<count {
            petControllers.append(PetWindowController(
                settingsStore: settingsStore,
                stateMachine: PetStateMachine(),
                petIndex: index
            ))
        }
    }

    private func updateProximityInteractionTimer() {
        guard activePetControllers.filter(\.isVisible).count > 1 else {
            stopProximityInteractionTimer()
            return
        }

        startProximityInteractionTimer()
    }

    private func startProximityInteractionTimer() {
        guard proximityInteractionTimer == nil else {
            return
        }

        let timer = Timer(timeInterval: proximityCheckInterval, repeats: true) { [weak self] _ in
            self?.updateProximityInteractions()
        }
        RunLoop.main.add(timer, forMode: .common)
        proximityInteractionTimer = timer
    }

    private func stopProximityInteractionTimer() {
        proximityInteractionTimer?.invalidate()
        proximityInteractionTimer = nil
    }

    private func updateProximityInteractions() {
        let visibleControllers = activePetControllers.enumerated().filter { _, controller in
            controller.isVisible && controller.frame != nil
        }

        guard visibleControllers.count > 1 else {
            updateProximityInteractionTimer()
            return
        }

        for firstOffset in 0..<(visibleControllers.count - 1) {
            for secondOffset in (firstOffset + 1)..<visibleControllers.count {
                let first = visibleControllers[firstOffset]
                let second = visibleControllers[secondOffset]

                guard let firstFrame = first.element.frame,
                      let secondFrame = second.element.frame,
                      arePetsClose(firstFrame, secondFrame) else {
                    continue
                }

                guard Double.random(in: 0...1) <= proximityInteractionProbability else {
                    continue
                }

                let sideForFirst = secondFrame.midX < firstFrame.midX ? PetInteractionSide.left : .right
                let sideForSecond = firstFrame.midX < secondFrame.midX ? PetInteractionSide.left : .right

                if Bool.random() {
                    tryTriggerPairedProximityInteraction(
                        initiator: first.element,
                        initiatorIndex: first.offset,
                        initiatorSide: sideForFirst,
                        responder: second.element,
                        responderIndex: second.offset
                    )
                } else {
                    tryTriggerPairedProximityInteraction(
                        initiator: second.element,
                        initiatorIndex: second.offset,
                        initiatorSide: sideForSecond,
                        responder: first.element,
                        responderIndex: first.offset
                    )
                }
            }
        }
    }

    private func arePetsClose(_ firstFrame: NSRect, _ secondFrame: NSRect) -> Bool {
        firstFrame.insetBy(dx: -proximityMargin, dy: -proximityMargin).intersects(secondFrame)
    }

    private func tryTriggerPairedProximityInteraction(
        initiator: PetWindowController,
        initiatorIndex: Int,
        initiatorSide: PetInteractionSide,
        responder: PetWindowController,
        responderIndex: Int
    ) {
        guard !isInProximityCooldown(petIndex: initiatorIndex),
              let initiatorSlot = initiator.randomNearbyPetInteractionSlot(from: initiatorSide),
              initiator.triggerNearbyPetInteraction(slot: initiatorSlot) else {
            return
        }

        lastProximityInteractionAt[initiatorIndex] = Date()

        guard let responseSlot = initiatorSlot.matchingNearbyResponseSlot,
              responder.triggerNearbyPetInteraction(slot: responseSlot) else {
            return
        }

        lastProximityInteractionAt[responderIndex] = Date()
    }

    private func isInProximityCooldown(petIndex: Int) -> Bool {
        guard let lastInteractionDate = lastProximityInteractionAt[petIndex] else {
            return false
        }

        return Date().timeIntervalSince(lastInteractionDate) < proximityInteractionCooldown
    }

    private var activePetControllers: [PetWindowController] {
        ensurePetControllers(upTo: settingsStore.petCount)
        return Array(petControllers.prefix(settingsStore.petCount))
    }

    private var inactivePetControllers: [PetWindowController] {
        ensurePetControllers(upTo: settingsStore.petCount)
        return Array(petControllers.dropFirst(settingsStore.petCount))
    }
}
