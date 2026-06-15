import AppKit
import Foundation
import UniformTypeIdentifiers

@MainActor
final class PetStudioViewModel: ObservableObject {
    private enum Keys {
        static let creditBalance = "studio.creditBalance"

        static func sourceImagePath(for petIndex: Int) -> String {
            "studio.pet.\(petIndex).sourceImagePath"
        }

        static func generatedFrontImagePath(for petIndex: Int) -> String {
            "studio.pet.\(petIndex).generatedFrontImagePath"
        }

        static func isFrontImageConfirmed(for petIndex: Int) -> String {
            "studio.pet.\(petIndex).isFrontImageConfirmed"
        }

        static func generatedSlots(for petIndex: Int) -> String {
            "studio.pet.\(petIndex).generatedSlots"
        }
    }

    private let defaults: UserDefaults
    private let settingsStore: SettingsStore
    private let petColonyController: PetColonyController
    private let desktopSyncClient: DesktopPetSyncClient
    private let onLibraryChanged: () -> Void
    private let frontImageCreditCost = 10

    @Published private(set) var selectedPetIndex = 0
    @Published private(set) var petNames: [String] = []
    @Published var petNameDraft = ""
    @Published private(set) var sourceImageURL: URL?
    @Published private(set) var generatedFrontImageURL: URL?
    @Published private(set) var isFrontImageConfirmed = false
    @Published private(set) var creditBalance: Int
    @Published private(set) var isGeneratingFrontImage = false
    @Published private(set) var isSyncingDesktopBundle = false
    @Published private(set) var generatingSlots: Set<PetActionSlot> = []
    @Published private(set) var generatedSlots: Set<PetActionSlot> = []
    @Published private(set) var localVideoSlots: Set<PetActionSlot> = []
    @Published var statusMessage = "上传猫咪图片后，就可以生成正面形象。"

    init(
        settingsStore: SettingsStore,
        petColonyController: PetColonyController,
        desktopSyncClient: DesktopPetSyncClient = DesktopPetSyncClient(),
        defaults: UserDefaults = .standard,
        onLibraryChanged: @escaping () -> Void = {}
    ) {
        self.settingsStore = settingsStore
        self.petColonyController = petColonyController
        self.desktopSyncClient = desktopSyncClient
        self.defaults = defaults
        self.onLibraryChanged = onLibraryChanged

        let savedBalance = defaults.object(forKey: Keys.creditBalance) as? Int
        creditBalance = savedBalance ?? 120

        refreshPetList()
        loadSelectedPetDraft()
    }

    var frontImageCost: Int {
        frontImageCreditCost
    }

    var canGenerateFrontImage: Bool {
        sourceImageURL != nil && !isGeneratingFrontImage && creditBalance >= frontImageCreditCost
    }

    var canConfirmFrontImage: Bool {
        generatedFrontImageURL != nil && !isGeneratingFrontImage
    }

    func refreshPetList() {
        petNames = (0..<settingsStore.petCount).map { settingsStore.petName(for: $0) }

        let clampedIndex = clampedPetIndex(selectedPetIndex)
        if selectedPetIndex != clampedIndex {
            selectedPetIndex = clampedIndex
            loadSelectedPetDraft()
            return
        }

        petNameDraft = petNames.indices.contains(selectedPetIndex)
            ? petNames[selectedPetIndex]
            : "Pet \(selectedPetIndex + 1)"
    }

    func selectPet(at index: Int) {
        let clampedIndex = clampedPetIndex(index)
        guard selectedPetIndex != clampedIndex else {
            return
        }

        selectedPetIndex = clampedIndex
        loadSelectedPetDraft()
    }

    func addPet() {
        let newPetIndex = petColonyController.addPet()
        refreshPetList()
        selectPet(at: newPetIndex)
        onLibraryChanged()
    }

    func savePetName() {
        settingsStore.setPetName(petNameDraft, for: selectedPetIndex)
        petColonyController.refreshDisplayNames()
        refreshPetList()
        onLibraryChanged()
    }

    func chooseSourceImage() {
        let panel = NSOpenPanel()
        panel.title = "选择猫咪图片"
        panel.prompt = "选择图片"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.image]

        guard panel.runModal() == .OK, let url = panel.url else {
            return
        }

        sourceImageURL = url
        generatedFrontImageURL = nil
        isFrontImageConfirmed = false
        statusMessage = "已选择图片。下一步可以生成正面形象。"
        persistSelectedPetDraft()
    }

    func generateFrontImage() {
        guard canGenerateFrontImage, let sourceImageURL else {
            return
        }

        isGeneratingFrontImage = true
        isFrontImageConfirmed = false
        statusMessage = "正在生成正面形象。当前是 UI mock，后续会接 GPT Image API。"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self else {
                return
            }

            self.creditBalance -= self.frontImageCreditCost
            self.generatedFrontImageURL = sourceImageURL
            self.isGeneratingFrontImage = false
            self.statusMessage = "正面形象已生成。当前预览先使用原图占位。"
            self.persistCreditBalance()
            self.persistSelectedPetDraft()
        }
    }

    func regenerateFrontImage() {
        generateFrontImage()
    }

    func confirmFrontImage() {
        guard canConfirmFrontImage else {
            return
        }

        isFrontImageConfirmed = true
        statusMessage = "正面形象已确认。现在可以生成各个状态视频。"
        persistSelectedPetDraft()
    }

    func canGenerate(slot: PetActionSlot) -> Bool {
        isFrontImageConfirmed
            && slot.isApiGenerationEnabledInPrototype
            && !generatingSlots.contains(slot)
            && creditBalance >= slot.generationCreditCost
    }

    func generate(slot: PetActionSlot) {
        guard canGenerate(slot: slot) else {
            return
        }

        generatingSlots.insert(slot)
        statusMessage = "正在生成「\(slot.displayName)」。当前是 UI mock，后续会接即梦视频 API。"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            guard let self else {
                return
            }

            self.creditBalance -= slot.generationCreditCost
            self.generatingSlots.remove(slot)
            self.generatedSlots.insert(slot)
            self.statusMessage = "「\(slot.displayName)」生成完成占位。接入 API 后这里会保存返回的视频素材。"
            self.persistCreditBalance()
            self.persistGeneratedSlots()
        }
    }

    func importLocalVideo(for slot: PetActionSlot) {
        let panel = NSOpenPanel()
        panel.title = "导入「\(slot.displayName)」视频"
        panel.prompt = "导入"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.mpeg4Movie, .quickTimeMovie, .movie]

        guard panel.runModal() == .OK, let url = panel.url else {
            return
        }

        settingsStore.saveVideoURL(url, for: slot, petIndex: selectedPetIndex)
        localVideoSlots.insert(slot)

        if slot == .idleLoop {
            settingsStore.isPetVisible = true
            petColonyController.showAll()
        } else {
            petColonyController.refreshPlayback()
        }

        statusMessage = "已导入「\(slot.displayName)」本地视频。"
        onLibraryChanged()
        objectWillChange.send()
    }

    func removeLocalVideo(for slot: PetActionSlot) {
        settingsStore.removeVideo(for: slot, petIndex: selectedPetIndex)
        localVideoSlots.remove(slot)

        if slot == .idleLoop, settingsStore.isPetVisible {
            settingsStore.isPetVisible = petColonyController.showAll()
        } else {
            petColonyController.refreshPlayback()
        }

        statusMessage = "已移除「\(slot.displayName)」本地视频。"
        onLibraryChanged()
        objectWillChange.send()
    }

    func hasLocalVideo(for slot: PetActionSlot) -> Bool {
        localVideoSlots.contains(slot)
    }

    func syncFromWebStudio() {
        guard !isSyncingDesktopBundle else {
            return
        }

        isSyncingDesktopBundle = true
        statusMessage = "正在从网页同步生成好的素材..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                let summary = try await self.desktopSyncClient.importLatestBundle(
                    settingsStore: self.settingsStore,
                    petColonyController: self.petColonyController
                )

                self.refreshPetList()
                self.loadSelectedPetDraft()
                self.isSyncingDesktopBundle = false
                self.statusMessage = "已从网页同步 \(summary.petCount) 只宠物、\(summary.materialCount) 个动作素材。"
                self.onLibraryChanged()
            } catch {
                self.isSyncingDesktopBundle = false
                self.statusMessage = error.localizedDescription
            }
        }
    }

    func localVideoURL(for slot: PetActionSlot) -> URL? {
        guard hasLocalVideo(for: slot) else {
            return nil
        }

        return settingsStore.restoreVideoURL(for: slot, petIndex: selectedPetIndex)
    }

    func materialStatus(for slot: PetActionSlot) -> String {
        if hasLocalVideo(for: slot) {
            return "已有视频"
        }

        if generatingSlots.contains(slot) {
            return "生成中"
        }

        if generatedSlots.contains(slot) {
            return "已生成占位"
        }

        return "未生成"
    }

    func isGeneratedPlaceholder(for slot: PetActionSlot) -> Bool {
        generatedSlots.contains(slot) && !hasLocalVideo(for: slot)
    }

    private func loadSelectedPetDraft() {
        guard selectedPetIndex >= 0 else {
            return
        }

        let sourcePath = defaults.string(forKey: Keys.sourceImagePath(for: selectedPetIndex))
        let generatedPath = defaults.string(forKey: Keys.generatedFrontImagePath(for: selectedPetIndex))
        sourceImageURL = sourcePath.map { URL(fileURLWithPath: $0) }
        generatedFrontImageURL = generatedPath.map { URL(fileURLWithPath: $0) }
        isFrontImageConfirmed = defaults.bool(forKey: Keys.isFrontImageConfirmed(for: selectedPetIndex))

        let rawGeneratedSlots = defaults.stringArray(forKey: Keys.generatedSlots(for: selectedPetIndex)) ?? []
        generatedSlots = Set(rawGeneratedSlots.compactMap(PetActionSlot.init(rawValue:)))
        localVideoSlots = settingsStore.savedVideoSlots(for: selectedPetIndex)

        petNameDraft = settingsStore.petName(for: selectedPetIndex)

        if isFrontImageConfirmed {
            statusMessage = "正面形象已确认，可以继续生成状态视频。"
        } else if generatedFrontImageURL != nil {
            statusMessage = "正面形象已生成，确认后即可生成状态视频。"
        } else if sourceImageURL != nil {
            statusMessage = "已选择图片。下一步可以生成正面形象。"
        } else {
            statusMessage = "上传猫咪图片后，就可以生成正面形象。"
        }
    }

    private func persistSelectedPetDraft() {
        defaults.set(sourceImageURL?.path, forKey: Keys.sourceImagePath(for: selectedPetIndex))
        defaults.set(generatedFrontImageURL?.path, forKey: Keys.generatedFrontImagePath(for: selectedPetIndex))
        defaults.set(isFrontImageConfirmed, forKey: Keys.isFrontImageConfirmed(for: selectedPetIndex))
    }

    private func persistGeneratedSlots() {
        let rawValues = generatedSlots.map(\.rawValue)
        defaults.set(rawValues, forKey: Keys.generatedSlots(for: selectedPetIndex))
    }

    private func persistCreditBalance() {
        defaults.set(creditBalance, forKey: Keys.creditBalance)
    }

    private func clampedPetIndex(_ index: Int) -> Int {
        min(max(index, 0), max(petNames.count - 1, 0))
    }
}
