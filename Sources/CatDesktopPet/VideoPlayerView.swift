import AppKit
import AVFoundation
import CoreImage
import QuartzCore

enum VideoPlaybackMode {
    case loop
    case playOnce
    case scrub
}

final class VideoPlayerView: NSView {
    private let renderer = ChromaKeyRenderer()
    private var player: AVPlayer?
    private var videoOutput: AVPlayerItemVideoOutput?
    private var endObserver: NSObjectProtocol?
    private var displayTimer: Timer?
    private var currentURL: URL?
    private var playbackMode: VideoPlaybackMode = .loop
    private var onPlaybackEnded: (() -> Void)?
    private var securityScopedURL: URL?
    private var lastRenderedImage: CGImage?
    private var pendingScrubProgress: Double?
    private var lastRequestedScrubProgress: Double?
    private var isScrubSeekInFlight = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configureView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configureView()
    }

    deinit {
        displayTimer?.invalidate()

        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }

        securityScopedURL?.stopAccessingSecurityScopedResource()
    }

    override var isOpaque: Bool {
        false
    }

    override func hitTest(_ point: NSPoint) -> NSView? {
        nil
    }

    func loadVideo(
        from url: URL,
        mode: VideoPlaybackMode = .loop,
        onPlaybackEnded: (() -> Void)? = nil
    ) {
        if currentURL == url, playbackMode == mode {
            self.onPlaybackEnded = onPlaybackEnded
            return
        }

        stopCurrentVideo()

        currentURL = url
        playbackMode = mode
        self.onPlaybackEnded = onPlaybackEnded

        if url.startAccessingSecurityScopedResource() {
            securityScopedURL = url
        }

        let pixelBufferAttributes: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        let videoOutput = AVPlayerItemVideoOutput(pixelBufferAttributes: pixelBufferAttributes)
        let playerItem = AVPlayerItem(url: url)
        playerItem.add(videoOutput)

        let player = AVPlayer(playerItem: playerItem)
        player.actionAtItemEnd = mode == .loop ? .none : .pause
        player.isMuted = true

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: playerItem,
            queue: .main
        ) { [weak self, weak player] _ in
            guard let self else {
                return
            }

            switch self.playbackMode {
            case .loop:
                player?.seek(to: .zero)
                player?.play()
            case .playOnce:
                self.onPlaybackEnded?()
            case .scrub:
                break
            }
        }

        self.videoOutput = videoOutput
        self.player = player
        startDisplayTimerIfNeeded()
        warmUpFirstFrameIfNeeded(for: mode)

        if mode == .scrub {
            player.pause()
            seek(toProgress: 0)
        }
    }

    func play() {
        guard playbackMode != .scrub else {
            return
        }

        player?.play()
        startDisplayTimerIfNeeded()
    }

    func pause() {
        player?.pause()
        displayTimer?.invalidate()
        displayTimer = nil
    }

    func seek(toProgress progress: Double) {
        guard playbackMode == .scrub else {
            return
        }

        let clampedProgress = min(max(progress, 0), 0.999)

        if let lastRequestedScrubProgress,
           abs(lastRequestedScrubProgress - clampedProgress) < 0.003 {
            return
        }

        pendingScrubProgress = clampedProgress
        performPendingScrubSeekIfNeeded()
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let context = NSGraphicsContext.current?.cgContext else {
            return
        }

        context.clear(bounds)

        if let image = nextFrameImage() {
            lastRenderedImage = image
        }

        guard let image = lastRenderedImage else {
            return
        }

        context.interpolationQuality = .high
        context.draw(image, in: aspectFitRect(imageSize: CGSize(width: image.width, height: image.height), bounds: bounds))
    }

    private func configureView() {
        wantsLayer = true
        layer?.isOpaque = false
        layer?.backgroundColor = NSColor.clear.cgColor
        layerContentsRedrawPolicy = .onSetNeedsDisplay
    }

    private func stopCurrentVideo() {
        player?.pause()
        player = nil
        videoOutput = nil
        currentURL = nil
        onPlaybackEnded = nil
        pendingScrubProgress = nil
        lastRequestedScrubProgress = nil
        isScrubSeekInFlight = false

        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }

        securityScopedURL?.stopAccessingSecurityScopedResource()
        securityScopedURL = nil
    }

    private func warmUpFirstFrameIfNeeded(for mode: VideoPlaybackMode) {
        guard mode != .scrub else {
            return
        }

        player?.seek(
            to: .zero,
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] _ in
            self?.needsDisplay = true
        }
    }

    private func startDisplayTimerIfNeeded() {
        guard displayTimer == nil else {
            return
        }

        let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            self?.needsDisplay = true
        }
        RunLoop.main.add(timer, forMode: .common)
        displayTimer = timer
    }

    private func nextFrameImage() -> CGImage? {
        guard let videoOutput else {
            return nil
        }

        let itemTime: CMTime

        switch playbackMode {
        case .loop, .playOnce:
            itemTime = videoOutput.itemTime(forHostTime: CACurrentMediaTime())

            guard videoOutput.hasNewPixelBuffer(forItemTime: itemTime) else {
                return nil
            }
        case .scrub:
            guard let player else {
                return nil
            }

            itemTime = player.currentTime()
        }

        guard let pixelBuffer = videoOutput.copyPixelBuffer(forItemTime: itemTime, itemTimeForDisplay: nil) else {
            return nil
        }

        return renderer.makeChromaKeyedImage(from: pixelBuffer)
    }

    private func performPendingScrubSeekIfNeeded() {
        guard !isScrubSeekInFlight,
              let progress = pendingScrubProgress,
              let targetTime = scrubTime(for: progress),
              let player else {
            return
        }

        pendingScrubProgress = nil
        lastRequestedScrubProgress = progress
        isScrubSeekInFlight = true

        let tolerance = CMTime(seconds: 1.0 / 30.0, preferredTimescale: 600)
        player.seek(
            to: targetTime,
            toleranceBefore: tolerance,
            toleranceAfter: tolerance
        ) { [weak self] _ in
            guard let self else {
                return
            }

            self.isScrubSeekInFlight = false
            self.needsDisplay = true
            self.performPendingScrubSeekIfNeeded()
        }
    }

    private func scrubTime(for progress: Double) -> CMTime? {
        guard let duration = player?.currentItem?.duration.seconds,
              duration.isFinite,
              duration > 0 else {
            return nil
        }

        let maxTime = max(duration - 1.0 / 60.0, 0)
        let seconds = min(max(progress * duration, 0), maxTime)
        return CMTime(seconds: seconds, preferredTimescale: 600)
    }

    private func aspectFitRect(imageSize: CGSize, bounds: CGRect) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, bounds.width > 0, bounds.height > 0 else {
            return bounds
        }

        let scale = min(bounds.width / imageSize.width, bounds.height / imageSize.height)
        let width = imageSize.width * scale
        let height = imageSize.height * scale

        return CGRect(
            x: bounds.midX - width / 2,
            y: bounds.midY - height / 2,
            width: width,
            height: height
        )
    }
}
