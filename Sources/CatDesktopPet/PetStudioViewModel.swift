import AppKit
import Foundation
import UniformTypeIdentifiers

struct DesktopSyncedPetCard: Identifiable, Equatable, Codable {
    let id: String
    let petNumber: String
    let name: String
    let ownership: String
    let displayState: String
    let avatarURL: URL?
    let materialCount: Int

    var statusText: String {
        switch displayState {
        case "active":
            ownership == "hosted" ? "寄养在我的桌面" : "在我的桌面"
        case "unavailable":
            "托管在朋友那里"
        case "hidden":
            "已隐藏"
        default:
            "等待同步"
        }
    }

    var canRecall: Bool {
        displayState == "unavailable" || ownership == "away"
    }

    var canRequestHosting: Bool {
        ownership == "owned" && displayState == "active"
    }

    func shouldShowRecallAction(isSelected: Bool) -> Bool {
        isSelected && canRecall
    }
}

struct DesktopFriendCard: Identifiable, Decodable, Equatable {
    let id: String
    let name: String
    let status: String
    let hostedPets: Int

    var isOnline: Bool {
        status == "在线"
    }
}

@MainActor
final class PetStudioViewModel: ObservableObject {
    private enum Keys {
        static let creditBalance = "studio.creditBalance"
        static let syncedPetCards = "studio.syncedPetCards"
        static let selectedSyncedPetID = "studio.selectedSyncedPetID"

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
    private let accountSessionStore: DesktopAccountSessionStore
    private let confirmMaterialReplacement: @MainActor ([String]) -> Bool
    private let onLibraryChanged: () -> Void
    private let frontImageCreditCost = 10
    private let cacheEncoder = JSONEncoder()
    private let cacheDecoder = JSONDecoder()

    @Published private(set) var currentAccount: DesktopAccountSession?
    @Published var loginEmail = "demo@desktop.pet"
    @Published var loginPassword = "123456"
    @Published private(set) var selectedPetIndex = 0
    @Published private(set) var petNames: [String] = []
    @Published var petNameDraft = ""
    @Published private(set) var sourceImageURL: URL?
    @Published private(set) var generatedFrontImageURL: URL?
    @Published private(set) var isFrontImageConfirmed = false
    @Published private(set) var creditBalance: Int
    @Published private(set) var isGeneratingFrontImage = false
    @Published private(set) var isLoggingIn = false
    @Published private(set) var isSyncingDesktopBundle = false
    @Published private(set) var generatingSlots: Set<PetActionSlot> = []
    @Published private(set) var generatedSlots: Set<PetActionSlot> = []
    @Published private(set) var localVideoSlots: Set<PetActionSlot> = []
    @Published private(set) var syncedPetCards: [DesktopSyncedPetCard] = []
    @Published var selectedSyncedPetID: String?
    @Published var friendEmailDraft = ""
    @Published private(set) var friendCards: [DesktopFriendCard] = []
    @Published private(set) var isRefreshingFriends = false
    @Published private(set) var isMutatingFriend = false
    @Published var statusMessage = ""

    init(
        settingsStore: SettingsStore,
        petColonyController: PetColonyController,
        desktopSyncClient: DesktopPetSyncClient = DesktopPetSyncClient(),
        accountSessionStore: DesktopAccountSessionStore = DesktopAccountSessionStore(),
        defaults: UserDefaults = .standard,
        confirmMaterialReplacement: @escaping @MainActor ([String]) -> Bool = PetStudioViewModel.presentMaterialReplacementReminder,
        onLibraryChanged: @escaping () -> Void = {}
    ) {
        self.settingsStore = settingsStore
        self.petColonyController = petColonyController
        self.desktopSyncClient = desktopSyncClient
        self.accountSessionStore = accountSessionStore
        self.confirmMaterialReplacement = confirmMaterialReplacement
        self.defaults = defaults
        self.onLibraryChanged = onLibraryChanged
        currentAccount = accountSessionStore.currentAccount

        let savedBalance = defaults.object(forKey: Keys.creditBalance) as? Int
        creditBalance = savedBalance ?? 120

        restoreSyncedPetCache()
        refreshPetList()
        loadSelectedPetDraft()
    }

    var frontImageCost: Int {
        frontImageCreditCost
    }

    var isSignedIn: Bool {
        currentAccount != nil
    }

    var shouldShowCompactAccountPanel: Bool {
        isSignedIn
    }

    var accountDisplayName: String {
        currentAccount?.name ?? "未登录"
    }

    var accountDetail: String {
        guard let currentAccount else {
            return "登录后可同步网页端账号下的宠物数据。"
        }

        return "\(currentAccount.email) · \(currentAccount.credits) 积分"
    }

    var selectedSyncedPetCard: DesktopSyncedPetCard? {
        if let selectedSyncedPetID,
           let pet = syncedPetCards.first(where: { $0.id == selectedSyncedPetID }) {
            return pet
        }

        return syncedPetCards.first
    }

    var canGenerateFrontImage: Bool {
        sourceImageURL != nil && !isGeneratingFrontImage && creditBalance >= frontImageCreditCost
    }

    var canConfirmFrontImage: Bool {
        (sourceImageURL != nil || generatedFrontImageURL != nil) && !isGeneratingFrontImage
    }

    var canAddFriend: Bool {
        isSignedIn
            && !isMutatingFriend
            && !friendEmailDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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

    func signInAccount() {
        guard !isLoggingIn else {
            return
        }

        let email = loginEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let password = loginPassword

        guard !email.isEmpty, !password.isEmpty else {
            statusMessage = "请输入邮箱和密码。"
            return
        }

        isLoggingIn = true
        statusMessage = "正在登录账号..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                let response = try await self.desktopSyncClient.login(email: email, password: password)
                let account = DesktopAccountSession(
                    id: response.account.id,
                    name: response.account.name,
                    email: response.account.email,
                    credits: response.account.credits,
                    accessToken: response.accessToken,
                    signedInAt: ISO8601DateFormatter().string(from: Date())
                )

                self.accountSessionStore.save(account)
                self.currentAccount = account
                self.creditBalance = account.credits
                self.persistCreditBalance()

                do {
                    self.friendCards = try await self.desktopSyncClient.fetchFriends(accessToken: account.accessToken)
                } catch {
                    self.friendCards = []
                }

                self.isLoggingIn = false
                self.statusMessage = "登录成功。点击同步获取账号下的猫咪。"
            } catch {
                self.isLoggingIn = false
                self.statusMessage = error.localizedDescription
            }
        }
    }

    func signOutAccount() {
        accountSessionStore.signOut()
        currentAccount = nil
        friendCards = []
        friendEmailDraft = ""
        statusMessage = "已退出账号。本地已同步的猫咪资料和视频素材已保留。"
    }

    func selectSyncedPet(_ petID: String) {
        selectedSyncedPetID = petID
        persistSyncedPetCache()
    }

    func requestHosting(to friend: DesktopFriendCard) {
        guard let currentAccount else {
            statusMessage = "请先登录账号。"
            return
        }

        guard let selectedSyncedPetCard else {
            statusMessage = "请先同步并选择一只猫咪。"
            return
        }

        guard selectedSyncedPetCard.canRequestHosting else {
            statusMessage = "这只猫现在不在我的桌面，先召回再寄养。"
            return
        }

        guard !isMutatingFriend else {
            return
        }

        isMutatingFriend = true
        statusMessage = "正在向 \(friend.name) 发起寄养请求..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                _ = try await self.desktopSyncClient.requestHosting(
                    petID: selectedSyncedPetCard.id,
                    toUserID: friend.id,
                    accessToken: currentAccount.accessToken
                )
                self.isMutatingFriend = false
                self.statusMessage = "已向 \(friend.name) 发起「\(selectedSyncedPetCard.name)」寄养请求。"
            } catch {
                self.isMutatingFriend = false
                self.statusMessage = error.localizedDescription
            }
        }
    }

    func recallSelectedPet() {
        guard let currentAccount else {
            statusMessage = "请先登录账号。"
            return
        }

        guard let selectedSyncedPetCard else {
            statusMessage = "请先同步并选择一只猫咪。"
            return
        }

        guard !isMutatingFriend else {
            return
        }

        isMutatingFriend = true
        statusMessage = "正在召回「\(selectedSyncedPetCard.name)」..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                _ = try await self.desktopSyncClient.recallPet(
                    petID: selectedSyncedPetCard.id,
                    accessToken: currentAccount.accessToken
                )
                self.markSyncedPetAsRecalled(petID: selectedSyncedPetCard.id)
                self.isMutatingFriend = false
                self.statusMessage = "已召回「\(selectedSyncedPetCard.name)」。"
            } catch {
                self.isMutatingFriend = false
                self.statusMessage = error.localizedDescription
            }
        }
    }

    func refreshFriends() {
        guard let currentAccount else {
            statusMessage = "请先登录账号。"
            return
        }

        guard !isRefreshingFriends else {
            return
        }

        Task { [weak self] in
            guard let self else {
                return
            }

            await self.refreshFriends(using: currentAccount.accessToken, shouldUpdateStatus: true)
        }
    }

    func addFriend() {
        guard let currentAccount else {
            statusMessage = "请先登录账号。"
            return
        }

        let email = friendEmailDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !email.isEmpty else {
            statusMessage = "请输入好友邮箱。"
            return
        }

        guard !isMutatingFriend else {
            return
        }

        isMutatingFriend = true
        statusMessage = "正在添加好友..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                let friend = try await self.desktopSyncClient.addFriend(
                    email: email,
                    accessToken: currentAccount.accessToken
                )
                self.upsertFriend(friend)
                self.friendEmailDraft = ""
                self.isMutatingFriend = false
                self.statusMessage = "已添加好友 \(friend.name)。"
            } catch {
                self.isMutatingFriend = false
                self.statusMessage = "添加失败，请确认账号邮箱。"
            }
        }
    }

    func removeFriend(_ friend: DesktopFriendCard) {
        guard let currentAccount else {
            statusMessage = "请先登录账号。"
            return
        }

        guard !isMutatingFriend else {
            return
        }

        isMutatingFriend = true
        statusMessage = "正在删除好友 \(friend.name)..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                _ = try await self.desktopSyncClient.removeFriend(
                    friendID: friend.id,
                    accessToken: currentAccount.accessToken
                )
                self.friendCards.removeAll { $0.id == friend.id }
                self.isMutatingFriend = false
                self.statusMessage = "已删除好友 \(friend.name)。"
            } catch {
                self.isMutatingFriend = false
                self.statusMessage = error.localizedDescription
            }
        }
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
        statusMessage = "绿幕形象已选好，确认后就能生成动作。"
        persistSelectedPetDraft()
    }

    func generateFrontImage() {
        guard canGenerateFrontImage, let sourceImageURL else {
            return
        }

        isGeneratingFrontImage = true
        isFrontImageConfirmed = false
        statusMessage = "Mac 端不再生成静态图，请直接确认准备好的绿幕图。"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self else {
                return
            }

            self.generatedFrontImageURL = sourceImageURL
            self.isGeneratingFrontImage = false
            self.statusMessage = "绿幕形象已准备好，确认后就能继续。"
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

        if generatedFrontImageURL == nil {
            generatedFrontImageURL = sourceImageURL
        }
        isFrontImageConfirmed = true
        statusMessage = "绿幕形象已确认。现在可以生成或导入动作视频。"
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
        statusMessage = "请在网页端生成后同步，或导入已经做好的视频。"

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            guard let self else {
                return
            }

            self.creditBalance -= slot.generationCreditCost
            self.generatingSlots.remove(slot)
            self.generatedSlots.insert(slot)
            self.statusMessage = "「\(slot.displayName)」已记入动作包。"
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

        let targetPetIndex = selectedPetIndex
        statusMessage = "正在检查「\(slot.displayName)」视频..."

        Task { [weak self] in
            guard let self else {
                return
            }

            let review = await inspectPetVideoImport(url: url)

            guard review.canImport else {
                self.statusMessage = review.blockingMessages.joined(separator: " ")
                return
            }

            self.settingsStore.saveVideoURL(url, for: slot, petIndex: targetPetIndex)

            if targetPetIndex == self.selectedPetIndex {
                self.localVideoSlots.insert(slot)
            }

            if slot == .idleLoop {
                self.settingsStore.isPetVisible = true
                self.petColonyController.showAll()
            } else {
                self.petColonyController.refreshPlayback()
            }

            let warningText = review.warningMessages.isEmpty
                ? ""
                : " \(review.warningMessages.joined(separator: " "))"
            self.statusMessage = "已导入「\(slot.displayName)」本地视频。\(warningText)"
            self.onLibraryChanged()
            self.objectWillChange.send()
        }
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

        guard let currentAccount else {
            statusMessage = "请先登录账号，再同步网页端宠物数据。"
            return
        }

        isSyncingDesktopBundle = true
        statusMessage = "正在从网页同步生成好的素材..."

        Task { [weak self] in
            guard let self else {
                return
            }

            do {
                let bundle = try await self.desktopSyncClient.fetchBundle(
                    accessToken: currentAccount.accessToken
                )
                let replacementDescriptions = bundle.localMaterialReplacementDescriptions(
                    settingsStore: self.settingsStore
                )

                if !replacementDescriptions.isEmpty
                    && !self.confirmMaterialReplacement(replacementDescriptions) {
                    self.isSyncingDesktopBundle = false
                    self.statusMessage = "已取消同步，本地动作保持不变。"
                    return
                }

                self.applySyncedPetCards(from: bundle)
                self.applySyncedAccount(from: bundle, fallbackToken: currentAccount.accessToken)
                if let refreshedToken = self.currentAccount?.accessToken {
                    await self.refreshFriends(using: refreshedToken, shouldUpdateStatus: false)
                }

                let summary = try await self.desktopSyncClient.importBundle(
                    bundle,
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
            return "已记入"
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
            statusMessage = "绿幕形象已确认，可以继续补动作。"
        } else if generatedFrontImageURL != nil {
            statusMessage = "绿幕形象已选好，确认后就能生成动作。"
        } else if sourceImageURL != nil {
            statusMessage = "绿幕形象已选好，确认后就能生成动作。"
        } else {
            statusMessage = ""
        }
    }

    private func applySyncedPetCards(from bundle: DesktopPetBundle) {
        let cards = bundle.pets.map { pet in
            DesktopSyncedPetCard(
                id: pet.id,
                petNumber: pet.petNumber ?? pet.id,
                name: pet.name,
                ownership: pet.ownership ?? "owned",
                displayState: pet.displayState ?? "active",
                avatarURL: pet.avatarUrl,
                materialCount: pet.materials.count
            )
        }

        syncedPetCards = cards

        guard !cards.isEmpty else {
            selectedSyncedPetID = nil
            persistSyncedPetCache()
            return
        }

        if let selectedSyncedPetID,
           cards.contains(where: { $0.id == selectedSyncedPetID }) {
            persistSyncedPetCache()
            return
        }

        selectedSyncedPetID = cards.first?.id
        persistSyncedPetCache()
    }

    private func applySyncedAccount(from bundle: DesktopPetBundle, fallbackToken: String) {
        guard let account = bundle.account else {
            return
        }

        let updatedAccount = DesktopAccountSession(
            id: account.id,
            name: account.name,
            email: account.email,
            credits: account.credits,
            accessToken: fallbackToken,
            signedInAt: currentAccount?.signedInAt ?? ISO8601DateFormatter().string(from: Date())
        )

        currentAccount = updatedAccount
        creditBalance = account.credits
        accountSessionStore.save(updatedAccount)
        persistCreditBalance()
    }

    private func refreshFriends(using accessToken: String, shouldUpdateStatus: Bool) async {
        isRefreshingFriends = true

        do {
            friendCards = try await desktopSyncClient.fetchFriends(accessToken: accessToken)
            if shouldUpdateStatus {
                statusMessage = friendCards.isEmpty ? "好友列表为空，可以用邮箱添加好友。" : "好友列表已刷新。"
            }
        } catch {
            if shouldUpdateStatus {
                statusMessage = error.localizedDescription
            }
        }

        isRefreshingFriends = false
    }

    private func upsertFriend(_ friend: DesktopFriendCard) {
        if let index = friendCards.firstIndex(where: { $0.id == friend.id }) {
            friendCards[index] = friend
        } else {
            friendCards.append(friend)
        }
    }

    private func markSyncedPetAsRecalled(petID: String) {
        syncedPetCards = syncedPetCards.map { pet in
            guard pet.id == petID else {
                return pet
            }

            return DesktopSyncedPetCard(
                id: pet.id,
                petNumber: pet.petNumber,
                name: pet.name,
                ownership: "owned",
                displayState: "active",
                avatarURL: pet.avatarURL,
                materialCount: pet.materialCount
            )
        }
        persistSyncedPetCache()
    }

    private func restoreSyncedPetCache() {
        guard let data = defaults.data(forKey: Keys.syncedPetCards),
              let cards = try? cacheDecoder.decode([DesktopSyncedPetCard].self, from: data) else {
            syncedPetCards = []
            selectedSyncedPetID = nil
            return
        }

        syncedPetCards = cards
        selectedSyncedPetID = defaults.string(forKey: Keys.selectedSyncedPetID)
        normalizeSelectedSyncedPetID()
    }

    private func persistSyncedPetCache() {
        normalizeSelectedSyncedPetID()

        guard !syncedPetCards.isEmpty else {
            defaults.removeObject(forKey: Keys.syncedPetCards)
            defaults.removeObject(forKey: Keys.selectedSyncedPetID)
            return
        }

        guard let data = try? cacheEncoder.encode(syncedPetCards) else {
            return
        }

        defaults.set(data, forKey: Keys.syncedPetCards)

        if let selectedSyncedPetID {
            defaults.set(selectedSyncedPetID, forKey: Keys.selectedSyncedPetID)
        } else {
            defaults.removeObject(forKey: Keys.selectedSyncedPetID)
        }
    }

    private func normalizeSelectedSyncedPetID() {
        guard !syncedPetCards.isEmpty else {
            selectedSyncedPetID = nil
            return
        }

        if let selectedSyncedPetID,
           syncedPetCards.contains(where: { $0.id == selectedSyncedPetID }) {
            return
        }

        selectedSyncedPetID = syncedPetCards.first?.id
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

    private static func presentMaterialReplacementReminder(_ descriptions: [String]) -> Bool {
        let preview = descriptions.prefix(6).joined(separator: "\n")
        let extraCount = max(0, descriptions.count - 6)
        let extraText = extraCount > 0 ? "\n还有 \(extraCount) 个动作也会被替换。" : ""
        let alert = NSAlert()
        alert.messageText = "同步会替换本地动作"
        alert.informativeText = "\(preview)\(extraText)\n\n继续同步后，这些位置会使用网页端最新素材。"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "继续同步")
        alert.addButton(withTitle: "先不覆盖")

        return alert.runModal() == .alertFirstButtonReturn
    }

    private func clampedPetIndex(_ index: Int) -> Int {
        min(max(index, 0), max(petNames.count - 1, 0))
    }
}
