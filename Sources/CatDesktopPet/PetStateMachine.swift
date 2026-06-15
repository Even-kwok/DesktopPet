import Foundation

enum PetState: String {
    case hidden
    case idle
    case sleeping
    case clicked
    case catchingBug
    case idleAction
    case socialInteraction
    case grabbed
    case dropped
}

enum PetEvent {
    case show
    case hide
    case click
    case mouseOverPet
    case idleActionDue
    case nearbyPet
    case reactionFinished
    case dragStarted
    case dragEnded
    case sleep
    case wake
}

final class PetStateMachine {
    private(set) var state: PetState = .hidden
    var onStateChanged: ((PetState) -> Void)?

    private var resetToken = UUID()

    func send(_ event: PetEvent) {
        switch event {
        case .show:
            transition(to: .idle)
        case .hide:
            transition(to: .hidden)
        case .sleep:
            guard state == .idle else {
                return
            }

            transition(to: .sleeping)
        case .wake:
            guard state == .sleeping else {
                return
            }

            transition(to: .idle)
        case .click:
            guard state != .grabbed, state != .hidden else {
                return
            }

            transition(to: .clicked)
        case .mouseOverPet:
            guard state == .idle else {
                return
            }

            transition(to: .catchingBug)
        case .idleActionDue:
            guard state == .idle else {
                return
            }

            transition(to: .idleAction)
        case .nearbyPet:
            guard state == .idle else {
                return
            }

            transition(to: .socialInteraction)
        case .reactionFinished:
            guard state == .clicked || state == .catchingBug || state == .idleAction || state == .socialInteraction else {
                return
            }

            transition(to: .idle)
        case .dragStarted:
            guard state != .hidden else {
                return
            }

            transition(to: .grabbed)
        case .dragEnded:
            guard state == .grabbed else {
                return
            }

            transition(to: .dropped)
            returnToIdle(after: 0.24)
        }
    }

    private func transition(to nextState: PetState) {
        guard state != nextState else {
            return
        }

        state = nextState
        resetToken = UUID()
        onStateChanged?(nextState)
    }

    private func returnToIdle(after delay: TimeInterval) {
        let token = resetToken

        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.resetToken == token, self.state != .hidden else {
                return
            }

            self.transition(to: .idle)
        }
    }
}
