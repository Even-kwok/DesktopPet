import Foundation

enum PetMaterialGroup: String, CaseIterable, Identifiable {
    case core
    case pointer
    case nearbyPet
    case idleLife
    case feeding
    case reserved

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .core:
            "基础状态"
        case .pointer:
            "鼠标触发"
        case .nearbyPet:
            "宠物靠近互动"
        case .idleLife:
            "待机生活动作"
        case .feeding:
            "喂食 / 条件动作"
        case .reserved:
            "备用动作"
        }
    }

    var description: String {
        switch self {
        case .core:
            "宠物显示、睡觉等基础素材。"
        case .pointer:
            "由用户点击或鼠标经过触发。"
        case .nearbyPet:
            "多只宠物靠近时成对触发。"
        case .idleLife:
            "宠物待机时自己随机播放。"
        case .feeding:
            "后续接入饥饿值、喂食系统后触发。"
        case .reserved:
            "先保留素材位，当前不主动触发。"
        }
    }
}

extension PetActionSlot {
    var materialGroup: PetMaterialGroup {
        switch self {
        case .idleLoop, .sleepLoop:
            .core
        case .clickReact, .catchBug, .catchBugUp:
            .pointer
        case .headRubLeft, .headRubRight, .angrySwipeLeft, .angrySwipeRight:
            .nearbyPet
        case .yawn, .lickBelly, .lickBack, .stretch, .happy, .disgusted, .clingy, .aloof, .bellyUp:
            .idleLife
        case .fullWashFace, .hungryMeow:
            .feeding
        case .dragLoop:
            .reserved
        }
    }

    var triggerDescription: String {
        switch self {
        case .idleLoop:
            "默认循环"
        case .sleepLoop:
            "长时间无操作"
        case .clickReact:
            "点击宠物"
        case .catchBug, .catchBugUp:
            "鼠标经过宠物"
        case .headRubLeft, .headRubRight, .angrySwipeLeft, .angrySwipeRight:
            "另一只宠物靠近"
        case .yawn, .lickBelly, .lickBack, .stretch, .happy, .disgusted, .clingy, .aloof, .bellyUp:
            "待机随机"
        case .fullWashFace:
            "吃饱后触发"
        case .hungryMeow:
            "饥饿时触发"
        case .dragLoop:
            "备用"
        }
    }

    var generationCreditCost: Int {
        switch materialGroup {
        case .core:
            self == .idleLoop ? 18 : 14
        case .pointer:
            12
        case .nearbyPet:
            12
        case .idleLife:
            10
        case .feeding:
            10
        case .reserved:
            8
        }
    }

    var isApiGenerationEnabledInPrototype: Bool {
        self != .dragLoop
    }
}
