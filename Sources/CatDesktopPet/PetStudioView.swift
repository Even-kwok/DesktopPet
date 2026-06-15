import AppKit
import SwiftUI

struct PetStudioView: View {
    @ObservedObject var viewModel: PetStudioViewModel
    @State private var previewingSlot: PetActionSlot?

    var body: some View {
        ZStack {
            StudioPalette.background
                .ignoresSafeArea()

            VStack(spacing: 18) {
                petHeader

                HStack(alignment: .top, spacing: 18) {
                    imageQuestPanel
                        .frame(width: 330)

                    materialBoard
                }
            }
            .padding(18)
        }
        .frame(minWidth: 1080, minHeight: 720)
        .foregroundStyle(StudioPalette.ink)
    }

    private var petHeader: some View {
        ZStack(alignment: .top) {
            VStack(spacing: 12) {
                Spacer()
                    .frame(height: 48)

                HStack(alignment: .center, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CatDesktopPet Studio")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(StudioPalette.muted)
                            .textCase(.uppercase)

                        HStack(spacing: 10) {
                            Picker("宠物", selection: petSelection) {
                                ForEach(Array(viewModel.petNames.enumerated()), id: \.offset) { index, name in
                                    Text(name).tag(index)
                                }
                            }
                            .labelsHidden()
                            .frame(width: 150)

                            Button {
                                viewModel.addPet()
                            } label: {
                                Label("添加宠物", systemImage: "plus")
                            }
                            .buttonStyle(StudioButtonStyle(kind: .secondary))
                        }
                    }

                    Spacer()

                    VStack(alignment: .center, spacing: 7) {
                        Text(viewModel.petNameDraft.isEmpty ? "Pet \(viewModel.selectedPetIndex + 1)" : viewModel.petNameDraft)
                            .font(.system(size: 27, weight: .heavy, design: .rounded))
                            .lineLimit(1)

                        Text(viewModel.isFrontImageConfirmed ? "形象已确认，可以继续补齐动作素材" : "先上传图片，生成一张可爱的正面形象")
                            .font(.callout)
                            .foregroundStyle(StudioPalette.muted)
                    }
                    .frame(maxWidth: 360)

                    Spacer()

                    HStack(spacing: 10) {
                        statChip(title: "积分", value: "\(viewModel.creditBalance)", icon: "creditcard.fill", color: StudioPalette.sun)
                        statChip(title: "素材", value: "\(viewModel.localVideoSlots.count)/\(PetActionSlot.allCases.count)", icon: "sparkles", color: StudioPalette.mint)
                    }
                }

                HStack(spacing: 10) {
                    TextField("给宠物起个名字", text: $viewModel.petNameDraft)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .background(StudioPalette.field)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                    Button("保存名字") {
                        viewModel.savePetName()
                    }
                    .buttonStyle(StudioButtonStyle(kind: .primary))
                }
                .frame(maxWidth: 520)

                Text(viewModel.statusMessage)
                    .font(.callout)
                    .foregroundStyle(StudioPalette.muted)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 720)
            }
            .padding(18)
            .frame(maxWidth: .infinity)
            .background(StudioPalette.panel)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(StudioPalette.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .padding(.top, 42)

            avatarView
        }
    }

    private var avatarView: some View {
        ZStack {
            Circle()
                .fill(StudioPalette.sky.opacity(0.45))
                .frame(width: 112, height: 112)

            Circle()
                .stroke(StudioPalette.panel, lineWidth: 8)
                .frame(width: 108, height: 108)

            ImagePreview(
                title: "",
                url: viewModel.generatedFrontImageURL ?? viewModel.sourceImageURL,
                style: .avatar
            )
            .frame(width: 96, height: 96)
        }
        .shadow(color: StudioPalette.shadow, radius: 14, x: 0, y: 8)
    }

    private var imageQuestPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            panelTitle("形象小屋", subtitle: "上传照片，生成一张可以继续做动作视频的正面形象。", icon: "pawprint.fill")

            HStack(spacing: 10) {
                ImagePreview(title: "原始照片", url: viewModel.sourceImageURL, style: .tile)
                ImagePreview(title: "正面形象", url: viewModel.generatedFrontImageURL, style: .tile)
            }

            Button {
                viewModel.chooseSourceImage()
            } label: {
                Label("上传宠物照片", systemImage: "photo.on.rectangle")
            }
            .buttonStyle(StudioButtonStyle(kind: .primary))

            HStack(spacing: 8) {
                Button {
                    viewModel.generateFrontImage()
                } label: {
                    if viewModel.isGeneratingFrontImage {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("生成正面")
                    }
                }
                .buttonStyle(StudioButtonStyle(kind: .secondary))
                .disabled(!viewModel.canGenerateFrontImage)

                Button("重新生成") {
                    viewModel.regenerateFrontImage()
                }
                .buttonStyle(StudioButtonStyle(kind: .secondary))
                .disabled(!viewModel.canGenerateFrontImage)
            }

            Button {
                viewModel.confirmFrontImage()
            } label: {
                Label(viewModel.isFrontImageConfirmed ? "形象已确认" : "确认形象", systemImage: viewModel.isFrontImageConfirmed ? "checkmark.seal.fill" : "checkmark.seal")
            }
            .buttonStyle(StudioButtonStyle(kind: viewModel.isFrontImageConfirmed ? .success : .secondary))
            .disabled(!viewModel.canConfirmFrontImage)

            VStack(alignment: .leading, spacing: 8) {
                infoRow(icon: "wand.and.stars", title: "生成正面", detail: "\(viewModel.frontImageCost) 积分 / 次")
                infoRow(icon: "film.stack", title: "生成动作", detail: "每个状态单独生成")
                infoRow(icon: "externaldrive", title: "本地素材", detail: "也可以直接导入 MP4 / MOV")
            }
            .padding(.top, 4)

            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(StudioPalette.panel)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(StudioPalette.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var materialBoard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                panelTitle("动作卡册", subtitle: "有素材的动作会进入对应触发池；点击卡片里的预览可查看本地动作视频。", icon: "play.square.stack.fill")

                Spacer()

                statusBadge("API 未接入", color: StudioPalette.muted)
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    ForEach(PetMaterialGroup.allCases) { group in
                        materialSection(for: group)
                    }
                }
                .padding(.bottom, 8)
            }
        }
        .padding(16)
        .background(StudioPalette.panel)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(StudioPalette.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func materialSection(for group: PetMaterialGroup) -> some View {
        let slots = PetActionSlot.allCases.filter { $0.materialGroup == group }
        let completeCount = slots.filter { viewModel.hasLocalVideo(for: $0) }.count

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .lastTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(group.title)
                        .font(.system(size: 17, weight: .heavy, design: .rounded))

                    Text(group.description)
                        .font(.caption)
                        .foregroundStyle(StudioPalette.muted)
                }

                Spacer()

                statusBadge("\(completeCount)/\(slots.count)", color: group.tint)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 220, maximum: 270), spacing: 12)], spacing: 12) {
                ForEach(slots, id: \.rawValue) { slot in
                    MaterialCard(
                        slot: slot,
                        groupTint: group.tint,
                        isPreviewing: previewingSlot == slot,
                        previewURL: previewingSlot == slot ? viewModel.localVideoURL(for: slot) : nil,
                        viewModel: viewModel
                    ) {
                        if previewingSlot == slot {
                            previewingSlot = nil
                        } else {
                            previewingSlot = slot
                        }
                    }
                }
            }
        }
    }

    private var petSelection: Binding<Int> {
        Binding(
            get: { viewModel.selectedPetIndex },
            set: {
                previewingSlot = nil
                viewModel.selectPet(at: $0)
            }
        )
    }

    private func panelTitle(_ title: String, subtitle: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(StudioPalette.accent)
                .frame(width: 30, height: 30)
                .background(StudioPalette.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(StudioPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func statChip(title: String, value: String, icon: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(StudioPalette.muted)
                Text(value)
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
            }
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 8)
        .background(color.opacity(0.14))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func infoRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(StudioPalette.accent)
                .frame(width: 22)

            Text(title)
                .font(.caption)
                .fontWeight(.semibold)

            Spacer()

            Text(detail)
                .font(.caption)
                .foregroundStyle(StudioPalette.muted)
        }
    }

    private func statusBadge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.caption)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct MaterialCard: View {
    let slot: PetActionSlot
    let groupTint: Color
    let isPreviewing: Bool
    let previewURL: URL?
    @ObservedObject var viewModel: PetStudioViewModel
    let onTogglePreview: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            previewStage

            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 8) {
                    Text(slot.displayName)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 6)

                    statusBadge
                }

                Text(slot.triggerDescription)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(StudioPalette.muted)

                Text(slot.rawValue)
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(groupTint)
                    .lineLimit(1)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(groupTint.opacity(0.12))
                    .clipShape(Capsule())
            }

            HStack(spacing: 8) {
                Label("\(slot.generationCreditCost) 分", systemImage: "bolt.fill")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(StudioPalette.sunText)

                Spacer()

                Button {
                    viewModel.generate(slot: slot)
                } label: {
                    if viewModel.generatingSlots.contains(slot) {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text("生成")
                    }
                }
                .buttonStyle(StudioButtonStyle(kind: .primary, compact: true))
                .disabled(!viewModel.canGenerate(slot: slot))
            }

            HStack(spacing: 8) {
                Button("导入") {
                    viewModel.importLocalVideo(for: slot)
                }
                .buttonStyle(StudioButtonStyle(kind: .secondary, compact: true))

                Button("删除") {
                    viewModel.removeLocalVideo(for: slot)
                }
                .buttonStyle(StudioButtonStyle(kind: .danger, compact: true))
                .disabled(!viewModel.hasLocalVideo(for: slot))
            }
        }
        .padding(10)
        .background(StudioPalette.card)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isPreviewing ? groupTint.opacity(0.8) : StudioPalette.line, lineWidth: isPreviewing ? 2 : 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .shadow(color: StudioPalette.shadow.opacity(0.7), radius: 7, x: 0, y: 4)
    }

    private var previewStage: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(StudioPalette.stage)

            Checkerboard()
                .opacity(0.42)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            if let previewURL, isPreviewing {
                StudioVideoPreview(url: previewURL, isPlaying: true)
                    .padding(8)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: viewModel.hasLocalVideo(for: slot) ? "play.circle.fill" : "film")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(viewModel.hasLocalVideo(for: slot) ? groupTint : StudioPalette.placeholder)

                    Text(viewModel.hasLocalVideo(for: slot) ? "点预览播放" : "等待素材")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(StudioPalette.muted)
                }
            }

            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        onTogglePreview()
                    } label: {
                        Image(systemName: isPreviewing ? "pause.fill" : "play.fill")
                            .font(.system(size: 12, weight: .bold))
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.white)
                    .background(viewModel.hasLocalVideo(for: slot) ? groupTint : StudioPalette.placeholder)
                    .clipShape(Circle())
                    .disabled(!viewModel.hasLocalVideo(for: slot))
                }
                .padding(8)
            }
        }
        .frame(height: 128)
    }

    private var statusBadge: some View {
        let status = viewModel.materialStatus(for: slot)
        let color: Color

        if viewModel.hasLocalVideo(for: slot) {
            color = StudioPalette.mint
        } else if viewModel.generatingSlots.contains(slot) {
            color = StudioPalette.sky
        } else if viewModel.isGeneratedPlaceholder(for: slot) {
            color = StudioPalette.sun
        } else {
            color = StudioPalette.muted
        }

        return Text(status)
            .font(.caption2)
            .fontWeight(.heavy)
            .padding(.horizontal, 7)
            .padding(.vertical, 4)
            .background(color.opacity(0.16))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct ImagePreview: View {
    enum Style {
        case tile
        case avatar
    }

    let title: String
    let url: URL?
    let style: Style

    @State private var image: NSImage?
    @State private var requestedURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: title.isEmpty ? 0 : 6) {
            if !title.isEmpty {
                Text(title)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(StudioPalette.muted)
            }

            previewSurface
        }
        .onAppear(perform: loadImage)
        .onChange(of: url) { _, _ in
            loadImage()
        }
    }

    @ViewBuilder
    private var previewSurface: some View {
        switch style {
        case .tile:
            surface(shape: RoundedRectangle(cornerRadius: 8), height: 116)
        case .avatar:
            surface(shape: Circle(), height: nil)
        }
    }

    private func surface<S: Shape>(shape: S, height: CGFloat?) -> some View {
        ZStack {
            shape
                .fill(style == .avatar ? StudioPalette.field : StudioPalette.stage)

            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
                    .clipShape(shape)
            } else {
                Image(systemName: style == .avatar ? "pawprint.fill" : "photo")
                    .font(.system(size: style == .avatar ? 32 : 28, weight: .bold))
                    .foregroundStyle(StudioPalette.placeholder)
            }
        }
        .frame(height: height)
        .overlay(
            shape
                .stroke(StudioPalette.line, lineWidth: 1)
        )
        .clipShape(shape)
    }

    private func loadImage() {
        image = nil
        requestedURL = url

        guard let url else {
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let loadedImage = NSImage(contentsOf: url)

            DispatchQueue.main.async {
                guard requestedURL == url else {
                    return
                }

                image = loadedImage
            }
        }
    }
}

private struct StudioVideoPreview: NSViewRepresentable {
    let url: URL
    let isPlaying: Bool

    func makeNSView(context: Context) -> VideoPlayerView {
        VideoPlayerView()
    }

    func updateNSView(_ nsView: VideoPlayerView, context: Context) {
        nsView.loadVideo(from: url, mode: .loop)

        if isPlaying {
            nsView.play()
        } else {
            nsView.pause()
        }
    }

    static func dismantleNSView(_ nsView: VideoPlayerView, coordinator: ()) {
        nsView.pause()
    }
}

private struct Checkerboard: View {
    var body: some View {
        Canvas { context, size in
            let square: CGFloat = 12
            let columns = Int(ceil(size.width / square))
            let rows = Int(ceil(size.height / square))

            for row in 0..<rows {
                for column in 0..<columns where (row + column).isMultiple(of: 2) {
                    let rect = CGRect(
                        x: CGFloat(column) * square,
                        y: CGFloat(row) * square,
                        width: square,
                        height: square
                    )
                    context.fill(Path(rect), with: .color(StudioPalette.checker))
                }
            }
        }
    }
}

private enum StudioButtonKind {
    case primary
    case secondary
    case success
    case danger
}

private struct StudioButtonStyle: ButtonStyle {
    let kind: StudioButtonKind
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 12 : 13, weight: .heavy, design: .rounded))
            .lineLimit(1)
            .padding(.horizontal, compact ? 10 : 13)
            .padding(.vertical, compact ? 6 : 9)
            .frame(maxWidth: compact ? nil : .infinity)
            .background(backgroundColor.opacity(configuration.isPressed ? 0.76 : 1))
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var backgroundColor: Color {
        switch kind {
        case .primary:
            StudioPalette.accent
        case .secondary:
            StudioPalette.field
        case .success:
            StudioPalette.mint
        case .danger:
            StudioPalette.danger.opacity(0.16)
        }
    }

    private var foregroundColor: Color {
        switch kind {
        case .primary, .success:
            .white
        case .secondary:
            StudioPalette.ink
        case .danger:
            StudioPalette.danger
        }
    }
}

private enum StudioPalette {
    static let background = Color(red: 0.94, green: 0.98, blue: 0.98)
    static let panel = Color(red: 1.00, green: 1.00, blue: 0.99)
    static let card = Color(red: 1.00, green: 0.995, blue: 0.98)
    static let field = Color(red: 0.90, green: 0.96, blue: 0.95)
    static let stage = Color(red: 0.91, green: 0.95, blue: 0.96)
    static let checker = Color.white.opacity(0.72)
    static let line = Color(red: 0.78, green: 0.87, blue: 0.86)
    static let ink = Color(red: 0.13, green: 0.18, blue: 0.20)
    static let muted = Color(red: 0.43, green: 0.52, blue: 0.55)
    static let placeholder = Color(red: 0.58, green: 0.67, blue: 0.69)
    static let accent = Color(red: 0.96, green: 0.39, blue: 0.47)
    static let mint = Color(red: 0.18, green: 0.68, blue: 0.48)
    static let sky = Color(red: 0.24, green: 0.58, blue: 0.92)
    static let sun = Color(red: 0.96, green: 0.68, blue: 0.20)
    static let sunText = Color(red: 0.78, green: 0.47, blue: 0.08)
    static let danger = Color(red: 0.88, green: 0.24, blue: 0.30)
    static let shadow = Color.black.opacity(0.10)
}

private extension PetMaterialGroup {
    var tint: Color {
        switch self {
        case .core:
            StudioPalette.sky
        case .pointer:
            StudioPalette.accent
        case .nearbyPet:
            Color(red: 0.48, green: 0.45, blue: 0.90)
        case .idleLife:
            StudioPalette.mint
        case .feeding:
            StudioPalette.sun
        case .reserved:
            StudioPalette.placeholder
        }
    }
}
