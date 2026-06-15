import AppKit
import QuartzCore

protocol PetViewDelegate: AnyObject {
    func petViewDidClick(_ petView: PetView)
    func petView(_ petView: PetView, didDragBy delta: NSPoint)
}

final class PetView: NSView {
    let videoPlayerView = VideoPlayerView()
    weak var delegate: PetViewDelegate?
    private var lastDragLocation: NSPoint?
    private var dragStartLocation: NSPoint?
    private var didMoveDuringCurrentClick = false
    private let clickDragThreshold: CGFloat = 3

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configureView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configureView()
    }

    override var isOpaque: Bool {
        false
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        addCursorRect(bounds, cursor: .openHand)
    }

    override func mouseDown(with event: NSEvent) {
        let location = NSEvent.mouseLocation
        lastDragLocation = location
        dragStartLocation = location
        didMoveDuringCurrentClick = false
        NSCursor.closedHand.set()
    }

    override func mouseDragged(with event: NSEvent) {
        let location = NSEvent.mouseLocation

        if let dragStartLocation {
            let totalDeltaX = location.x - dragStartLocation.x
            let totalDeltaY = location.y - dragStartLocation.y
            didMoveDuringCurrentClick = didMoveDuringCurrentClick
                || hypot(totalDeltaX, totalDeltaY) > clickDragThreshold
        }

        guard let lastDragLocation else {
            self.lastDragLocation = location
            return
        }

        let delta = NSPoint(
            x: location.x - lastDragLocation.x,
            y: location.y - lastDragLocation.y
        )

        self.lastDragLocation = location

        guard delta.x != 0 || delta.y != 0 else {
            return
        }

        delegate?.petView(self, didDragBy: delta)
        NSCursor.closedHand.set()
    }

    override func mouseUp(with event: NSEvent) {
        if !didMoveDuringCurrentClick {
            delegate?.petViewDidClick(self)
        }

        lastDragLocation = nil
        dragStartLocation = nil
        didMoveDuringCurrentClick = false
        NSCursor.openHand.set()
    }

    func playDropBounce() {
        wantsLayer = true

        let animation = CAKeyframeAnimation(keyPath: "transform.translation.y")
        animation.values = [0, -10, 4, 0]
        animation.keyTimes = [0, 0.35, 0.75, 1]
        animation.duration = 0.24
        animation.timingFunctions = [
            CAMediaTimingFunction(name: .easeIn),
            CAMediaTimingFunction(name: .easeOut),
            CAMediaTimingFunction(name: .easeOut)
        ]

        layer?.add(animation, forKey: "dropBounce")
    }

    func setGrabbedAppearance(_: Bool) {
        wantsLayer = true
        layer?.transform = CATransform3DIdentity
        layer?.opacity = 1
    }

    private func configureView() {
        wantsLayer = true
        layer?.isOpaque = false
        layer?.backgroundColor = NSColor.clear.cgColor

        videoPlayerView.frame = bounds
        videoPlayerView.autoresizingMask = [.width, .height]
        addSubview(videoPlayerView)
    }
}
