import AppKit
import Foundation

enum PetActionSlot: String, CaseIterable, Codable {
    case idleLoop = "idle_loop"
    case catchBug = "catch_bug"
    case catchBugUp = "catch_bug_up"
    case clickReact = "click_react"
    case headRubLeft = "head_rub_left"
    case headRubRight = "head_rub_right"
    case angrySwipeLeft = "angry_swipe_left"
    case angrySwipeRight = "angry_swipe_right"
    case yawn = "yawn"
    case lickBelly = "lick_belly"
    case lickBack = "lick_back"
    case stretch = "stretch"
    case happy = "happy"
    case disgusted = "disgusted"
    case fullWashFace = "full_wash_face"
    case hungryMeow = "hungry_meow"
    case clingy = "clingy"
    case aloof = "aloof"
    case bellyUp = "belly_up"
    case lookAtCamera = "look_at_camera"
    case salaryCatStinkyDance = "salary_cat_stinky_dance"
    case headBobDance = "head_bob_dance"
    case dragLoop = "drag_loop"
    case sleepLoop = "sleep_loop"

    static let allCases: [PetActionSlot] = [
        .idleLoop,
        .catchBug,
        .catchBugUp,
        .clickReact,
        .headRubLeft,
        .headRubRight,
        .angrySwipeLeft,
        .angrySwipeRight,
        .yawn,
        .lickBelly,
        .lickBack,
        .stretch,
        .happy,
        .disgusted,
        .fullWashFace,
        .hungryMeow,
        .clingy,
        .aloof,
        .bellyUp,
        .lookAtCamera,
        .salaryCatStinkyDance,
        .headBobDance,
        .sleepLoop
    ]

    var displayName: String {
        switch self {
        case .idleLoop:
            "待机循环"
        case .catchBug:
            "鼠标经过抓虫子"
        case .catchBugUp:
            "双手抓上方虫子"
        case .clickReact:
            "点击反应"
        case .headRubLeft:
            "左边头蹭蹭"
        case .headRubRight:
            "右边头蹭蹭"
        case .angrySwipeLeft:
            "向左看生气挥一下爪子"
        case .angrySwipeRight:
            "向右看生气挥一下爪子"
        case .yawn:
            "打哈欠"
        case .lickBelly:
            "舔肚子的毛"
        case .lickBack:
            "舔背部的毛"
        case .stretch:
            "伸懒腰"
        case .happy:
            "开心"
        case .disgusted:
            "嫌弃"
        case .fullWashFace:
            "吃饱满足洗脸"
        case .hungryMeow:
            "饿了嗷嗷叫"
        case .clingy:
            "粘人"
        case .aloof:
            "高冷"
        case .bellyUp:
            "躺下翻肚皮"
        case .lookAtCamera:
            "看镜头"
        case .salaryCatStinkyDance:
            "跳月薪喵散屁舞"
        case .headBobDance:
            "摇头晃脑舞"
        case .dragLoop:
            "拖拽循环（备用）"
        case .sleepLoop:
            "睡觉"
        }
    }

    var pickerTitle: String {
        "Choose \(displayName) Video"
    }

    static let mouseoverCatchSlots: [PetActionSlot] = [
        .catchBug,
        .catchBugUp
    ]

    static let clickReactionSlots: [PetActionSlot] = [
        .clickReact,
        .happy,
        .disgusted,
        .clingy,
        .aloof,
        .bellyUp
    ]

    static let idleRandomActionSlots: [PetActionSlot] = [
        .yawn,
        .lickBelly,
        .lickBack,
        .stretch,
        .happy,
        .disgusted,
        .fullWashFace,
        .hungryMeow,
        .clingy,
        .aloof,
        .bellyUp,
        .lookAtCamera,
        .salaryCatStinkyDance,
        .headBobDance
    ]

    static func nearbyPetInteractionSlots(for side: PetInteractionSide) -> [PetActionSlot] {
        switch side {
        case .left:
            [
                .headRubLeft,
                .angrySwipeLeft
            ]
        case .right:
            [
                .headRubRight,
                .angrySwipeRight
            ]
        }
    }

    var matchingNearbyResponseSlot: PetActionSlot? {
        switch self {
        case .headRubLeft:
            .headRubRight
        case .headRubRight:
            .headRubLeft
        case .angrySwipeLeft:
            .angrySwipeRight
        case .angrySwipeRight:
            .angrySwipeLeft
        default:
            nil
        }
    }
}

enum PetInteractionSide {
    case left
    case right
}

final class SettingsStore {
    private enum Keys {
        static let legacyVideoPath = "videoPath"
        static let legacyVideoBookmark = "videoBookmark"
        static let petFrame = "catFrame"
        static let isPetVisible = "isCatVisible"
        static let isClickThrough = "isClickThrough"
        static let isMouseoverCatchEnabled = "isMouseoverCatchEnabled"
        static let petCount = "petCount"
        static let didMigrateToCompactPetSize = "didMigrateToCompactPetSize"

        static func petName(for index: Int) -> String {
            "pet.\(index).name"
        }

        static func petSizeScale(for index: Int) -> String {
            "pet.\(index).sizeScale"
        }

        static func petFrame(for index: Int) -> String {
            "petFrame.\(index)"
        }

        static func videoPath(for slot: PetActionSlot) -> String {
            "videoPath.\(slot.rawValue)"
        }

        static func videoBookmark(for slot: PetActionSlot) -> String {
            "videoBookmark.\(slot.rawValue)"
        }

        static func videoPath(for slot: PetActionSlot, petIndex: Int) -> String {
            "pet.\(petIndex).videoPath.\(slot.rawValue)"
        }

        static func videoBookmark(for slot: PetActionSlot, petIndex: Int) -> String {
            "pet.\(petIndex).videoBookmark.\(slot.rawValue)"
        }
    }

    private let defaults: UserDefaults

    static let petSizeScaleOptions: [CGFloat] = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]
    static let minPetSizeScale: CGFloat = 0.3
    static let maxPetSizeScale: CGFloat = 1.0
    private static let maxPetSize = CGSize(width: 150, height: 150)

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        migrateToCompactPetSizeIfNeeded()
    }

    var petFrame: CGRect {
        get {
            petFrame(for: 0)
        }
        set {
            setPetFrame(newValue, for: 0)
        }
    }

    var petCount: Int {
        get {
            guard let savedCount = defaults.object(forKey: Keys.petCount) as? Int else {
                return 1
            }

            return max(savedCount, 0)
        }
        set {
            defaults.set(max(newValue, 0), forKey: Keys.petCount)
        }
    }

    var isPetVisible: Bool {
        get {
            defaults.object(forKey: Keys.isPetVisible) as? Bool ?? false
        }
        set {
            defaults.set(newValue, forKey: Keys.isPetVisible)
        }
    }

    var isClickThrough: Bool {
        get {
            defaults.object(forKey: Keys.isClickThrough) as? Bool ?? false
        }
        set {
            defaults.set(newValue, forKey: Keys.isClickThrough)
        }
    }

    var isMouseoverCatchEnabled: Bool {
        get {
            defaults.object(forKey: Keys.isMouseoverCatchEnabled) as? Bool ?? true
        }
        set {
            defaults.set(newValue, forKey: Keys.isMouseoverCatchEnabled)
        }
    }

    func saveVideoURL(_ url: URL, for slot: PetActionSlot = .idleLoop, petIndex: Int = 0) {
        defaults.set(url.path, forKey: Keys.videoPath(for: slot, petIndex: petIndex))

        if petIndex == 0 {
            defaults.set(url.path, forKey: Keys.videoPath(for: slot))

            if slot == .idleLoop {
                defaults.set(url.path, forKey: Keys.legacyVideoPath)
            }
        }

        do {
            let bookmarkData = try url.bookmarkData(
                options: [.withSecurityScope],
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            defaults.set(bookmarkData, forKey: Keys.videoBookmark(for: slot, petIndex: petIndex))

            if petIndex == 0 {
                defaults.set(bookmarkData, forKey: Keys.videoBookmark(for: slot))

                if slot == .idleLoop {
                    defaults.set(bookmarkData, forKey: Keys.legacyVideoBookmark)
                }
            }
        } catch {
            NSLog("Failed to save security bookmark: \(error.localizedDescription)")
        }
    }

    func removeVideo(for slot: PetActionSlot = .idleLoop, petIndex: Int = 0) {
        defaults.removeObject(forKey: Keys.videoPath(for: slot, petIndex: petIndex))
        defaults.removeObject(forKey: Keys.videoBookmark(for: slot, petIndex: petIndex))

        if petIndex == 0 {
            defaults.removeObject(forKey: Keys.videoPath(for: slot))
            defaults.removeObject(forKey: Keys.videoBookmark(for: slot))

            if slot == .idleLoop {
                defaults.removeObject(forKey: Keys.legacyVideoPath)
                defaults.removeObject(forKey: Keys.legacyVideoBookmark)
            }
        }
    }

    func removePet(at index: Int) {
        let currentCount = petCount
        guard currentCount > 0, (0..<currentCount).contains(index) else {
            return
        }

        for sourceIndex in (index + 1)..<currentCount {
            copyPetData(from: sourceIndex, to: sourceIndex - 1)
        }

        clearPetData(at: currentCount - 1)
        petCount = currentCount - 1
    }

    func restoreVideoURL(for slot: PetActionSlot = .idleLoop, petIndex: Int = 0) -> URL? {
        if let url = restoreBookmarkedURL(for: slot, petIndex: petIndex) {
            return url
        }

        if petIndex == 0, let url = restoreSharedBookmarkedURL(for: slot) {
            return url
        }

        if petIndex == 0, slot == .idleLoop, let url = restoreLegacyBookmarkedURL() {
            return url
        }

        if let url = restorePathURL(for: slot, petIndex: petIndex) {
            return url
        }

        if petIndex == 0, let url = restoreSharedPathURL(for: slot) {
            return url
        }

        if petIndex == 0, slot == .idleLoop,
           let path = defaults.string(forKey: Keys.legacyVideoPath),
           FileManager.default.fileExists(atPath: path) {
            return URL(fileURLWithPath: path)
        }

        return nil
    }

    func hasVideo(for slot: PetActionSlot = .idleLoop, petIndex: Int = 0) -> Bool {
        restoreVideoURL(for: slot, petIndex: petIndex) != nil
    }

    func hasSavedVideoReference(for slot: PetActionSlot = .idleLoop, petIndex: Int = 0) -> Bool {
        if defaults.object(forKey: Keys.videoPath(for: slot, petIndex: petIndex)) != nil
            || defaults.object(forKey: Keys.videoBookmark(for: slot, petIndex: petIndex)) != nil {
            return true
        }

        guard petIndex == 0 else {
            return false
        }

        if defaults.object(forKey: Keys.videoPath(for: slot)) != nil
            || defaults.object(forKey: Keys.videoBookmark(for: slot)) != nil {
            return true
        }

        guard slot == .idleLoop else {
            return false
        }

        return defaults.object(forKey: Keys.legacyVideoPath) != nil
            || defaults.object(forKey: Keys.legacyVideoBookmark) != nil
    }

    func savedVideoSlots(for petIndex: Int) -> Set<PetActionSlot> {
        Set(PetActionSlot.allCases.filter { hasSavedVideoReference(for: $0, petIndex: petIndex) })
    }

    func petSizeScale(for index: Int) -> CGFloat {
        guard defaults.object(forKey: Keys.petSizeScale(for: index)) != nil else {
            return Self.maxPetSizeScale
        }

        return Self.clampedPetSizeScale(CGFloat(defaults.double(forKey: Keys.petSizeScale(for: index))))
    }

    func setPetSizeScale(_ scale: CGFloat, for index: Int) {
        let clampedScale = Self.clampedPetSizeScale(scale)
        defaults.set(Double(clampedScale), forKey: Keys.petSizeScale(for: index))
        setPetFrame(Self.frame(petFrame(for: index), applyingPetSizeScale: clampedScale), for: index)
    }

    func petFrame(for index: Int) -> CGRect {
        let key = Keys.petFrame(for: index)
        let frameString = defaults.string(forKey: key)
            ?? (index == 0 ? defaults.string(forKey: Keys.petFrame) : nil)

        guard let frameString else {
            return Self.frame(
                Self.defaultPetFrame(for: index),
                applyingPetSizeScale: petSizeScale(for: index)
            )
        }

        let frame = NSRectFromString(frameString)
        guard frame.width > 0, frame.height > 0 else {
            return Self.defaultPetFrame(for: index)
        }

        return frame
    }

    func setPetFrame(_ frame: CGRect, for index: Int) {
        defaults.set(NSStringFromRect(frame), forKey: Keys.petFrame(for: index))

        if index == 0 {
            defaults.set(NSStringFromRect(frame), forKey: Keys.petFrame)
        }
    }

    func petName(for index: Int) -> String {
        let trimmedName = defaults.string(forKey: Keys.petName(for: index))?
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let trimmedName, !trimmedName.isEmpty else {
            return "Pet \(index + 1)"
        }

        return trimmedName
    }

    func setPetName(_ name: String, for index: Int) {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedName.isEmpty else {
            defaults.removeObject(forKey: Keys.petName(for: index))
            return
        }

        defaults.set(trimmedName, forKey: Keys.petName(for: index))
    }

    private func copyPetData(from sourceIndex: Int, to targetIndex: Int) {
        copyDefaultValue(from: Keys.petName(for: sourceIndex), to: Keys.petName(for: targetIndex))
        copyDefaultValue(from: Keys.petSizeScale(for: sourceIndex), to: Keys.petSizeScale(for: targetIndex))
        copyDefaultValue(from: Keys.petFrame(for: sourceIndex), to: Keys.petFrame(for: targetIndex))

        if targetIndex == 0 {
            copyDefaultValue(from: Keys.petFrame(for: sourceIndex), to: Keys.petFrame)
        }

        for slot in PetActionSlot.allCases {
            copyDefaultValue(
                from: Keys.videoPath(for: slot, petIndex: sourceIndex),
                to: Keys.videoPath(for: slot, petIndex: targetIndex)
            )
            copyDefaultValue(
                from: Keys.videoBookmark(for: slot, petIndex: sourceIndex),
                to: Keys.videoBookmark(for: slot, petIndex: targetIndex)
            )

            if targetIndex == 0 {
                copyDefaultValue(
                    from: Keys.videoPath(for: slot, petIndex: sourceIndex),
                    to: Keys.videoPath(for: slot)
                )
                copyDefaultValue(
                    from: Keys.videoBookmark(for: slot, petIndex: sourceIndex),
                    to: Keys.videoBookmark(for: slot)
                )

                if slot == .idleLoop {
                    copyDefaultValue(
                        from: Keys.videoPath(for: slot, petIndex: sourceIndex),
                        to: Keys.legacyVideoPath
                    )
                    copyDefaultValue(
                        from: Keys.videoBookmark(for: slot, petIndex: sourceIndex),
                        to: Keys.legacyVideoBookmark
                    )
                }
            }
        }
    }

    private func clearPetData(at index: Int) {
        defaults.removeObject(forKey: Keys.petName(for: index))
        defaults.removeObject(forKey: Keys.petSizeScale(for: index))
        defaults.removeObject(forKey: Keys.petFrame(for: index))

        if index == 0 {
            defaults.removeObject(forKey: Keys.petFrame)
        }

        for slot in PetActionSlot.allCases {
            defaults.removeObject(forKey: Keys.videoPath(for: slot, petIndex: index))
            defaults.removeObject(forKey: Keys.videoBookmark(for: slot, petIndex: index))

            if index == 0 {
                defaults.removeObject(forKey: Keys.videoPath(for: slot))
                defaults.removeObject(forKey: Keys.videoBookmark(for: slot))

                if slot == .idleLoop {
                    defaults.removeObject(forKey: Keys.legacyVideoPath)
                    defaults.removeObject(forKey: Keys.legacyVideoBookmark)
                }
            }
        }
    }

    private func copyDefaultValue(from sourceKey: String, to targetKey: String) {
        guard let value = defaults.object(forKey: sourceKey) else {
            defaults.removeObject(forKey: targetKey)
            return
        }

        defaults.set(value, forKey: targetKey)
    }

    private func restoreBookmarkedURL(for slot: PetActionSlot, petIndex: Int) -> URL? {
        guard let bookmarkData = defaults.data(forKey: Keys.videoBookmark(for: slot, petIndex: petIndex)) else {
            return nil
        }

        return restoreURL(from: bookmarkData, for: slot, petIndex: petIndex)
    }

    private func restoreSharedBookmarkedURL(for slot: PetActionSlot) -> URL? {
        guard let bookmarkData = defaults.data(forKey: Keys.videoBookmark(for: slot)) else {
            return nil
        }

        return restoreURL(from: bookmarkData, for: slot, petIndex: 0)
    }

    private func restoreLegacyBookmarkedURL() -> URL? {
        guard let bookmarkData = defaults.data(forKey: Keys.legacyVideoBookmark) else {
            return nil
        }

        return restoreURL(from: bookmarkData, for: .idleLoop, petIndex: 0)
    }

    private func restoreURL(from bookmarkData: Data, for slot: PetActionSlot, petIndex: Int) -> URL? {
        do {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: [.withSecurityScope],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )

            if isStale {
                saveVideoURL(url, for: slot, petIndex: petIndex)
            }

            return url
        } catch {
            NSLog("Failed to restore security bookmark: \(error.localizedDescription)")
            return nil
        }
    }

    private func restorePathURL(for slot: PetActionSlot, petIndex: Int) -> URL? {
        guard let path = defaults.string(forKey: Keys.videoPath(for: slot, petIndex: petIndex)),
              FileManager.default.fileExists(atPath: path) else {
            return nil
        }

        return URL(fileURLWithPath: path)
    }

    private func restoreSharedPathURL(for slot: PetActionSlot) -> URL? {
        guard let path = defaults.string(forKey: Keys.videoPath(for: slot)),
              FileManager.default.fileExists(atPath: path) else {
            return nil
        }

        return URL(fileURLWithPath: path)
    }

    static func defaultPetFrame() -> CGRect {
        defaultPetFrame(for: 0)
    }

    static func defaultPetFrame(for index: Int) -> CGRect {
        let screenFrame = NSScreen.main?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1024, height: 768)
        let size = maxPetSize
        let columns = max(1, min(6, Int((screenFrame.width - size.width) / 42)))
        let column = max(index, 0) % columns
        let row = max(index, 0) / columns

        return CGRect(
            x: screenFrame.midX - size.width / 2 + CGFloat(column) * 34,
            y: screenFrame.midY - size.height / 2 - CGFloat(row) * 34,
            width: size.width,
            height: size.height
        )
    }

    static func clampedPetSizeScale(_ scale: CGFloat) -> CGFloat {
        guard scale.isFinite else {
            return maxPetSizeScale
        }

        return min(maxPetSizeScale, max(minPetSizeScale, scale))
    }

    static func frame(_ frame: CGRect, applyingPetSizeScale scale: CGFloat) -> CGRect {
        let clampedScale = clampedPetSizeScale(scale)
        let size = CGSize(
            width: maxPetSize.width * clampedScale,
            height: maxPetSize.height * clampedScale
        )

        return CGRect(
            x: frame.midX - size.width / 2,
            y: frame.midY - size.height / 2,
            width: size.width,
            height: size.height
        )
    }

    private func migrateToCompactPetSizeIfNeeded() {
        guard !defaults.bool(forKey: Keys.didMigrateToCompactPetSize),
              let frameString = defaults.string(forKey: Keys.petFrame) else {
            return
        }

        let frame = NSRectFromString(frameString)
        guard frame.width > 200 || frame.height > 200 else {
            defaults.set(true, forKey: Keys.didMigrateToCompactPetSize)
            return
        }

        let compactFrame = CGRect(
            x: frame.midX - frame.width * 0.25,
            y: frame.midY - frame.height * 0.25,
            width: frame.width * 0.5,
            height: frame.height * 0.5
        )

        defaults.set(NSStringFromRect(compactFrame), forKey: Keys.petFrame)
        defaults.set(NSStringFromRect(compactFrame), forKey: Keys.petFrame(for: 0))
        defaults.set(true, forKey: Keys.didMigrateToCompactPetSize)
    }
}
