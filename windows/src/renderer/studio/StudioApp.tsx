import { useEffect, useMemo, useState } from "react";
import {
  allPetActionSlots,
  materialGroupForSlot,
  petActionSlotDisplayName
} from "../../shared/pet-action-slots.ts";
import type { PetActionSlot, PetMaterialGroup } from "../../shared/pet-action-slots.ts";
import type { DesktopAccountSession } from "../../shared/settings-store.ts";
import type { DesktopPetBridge } from "../../preload/index.ts";

declare global {
  interface Window {
    desktopPet?: DesktopPetBridge;
  }
}

type StudioState = {
  account?: DesktopAccountSession;
  petCount: number;
  isPetVisible: boolean;
  isClickThrough: boolean;
  isMouseoverCatchEnabled: boolean;
};

const defaultStudioState: StudioState = {
  account: undefined,
  petCount: 1,
  isPetVisible: false,
  isClickThrough: false,
  isMouseoverCatchEnabled: true
};

const materialGroupTitles: Record<PetMaterialGroup, string> = {
  core: "基础状态",
  pointer: "鼠标触发",
  nearbyPet: "宠物靠近互动",
  idleLife: "待机生活动作",
  feeding: "喂食 / 条件动作",
  reserved: "备用动作"
};

export function StudioApp() {
  const [state, setState] = useState<StudioState>(defaultStudioState);
  const [email, setEmail] = useState("demo@desktop.pet");
  const [password, setPassword] = useState("123456");
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [petNameDraft, setPetNameDraft] = useState("Pet 1");
  const [friendEmail, setFriendEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const bridge = window.desktopPet;

  const refreshState = async () => {
    const nextState = (await bridge?.getStudioState?.()) as StudioState | undefined;
    if (nextState) {
      setState({ ...defaultStudioState, ...nextState });
      setSelectedPetIndex((current) => Math.min(current, Math.max(nextState.petCount - 1, 0)));
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  const groupedSlots = useMemo(() => {
    const groups = new Map<PetMaterialGroup, PetActionSlot[]>();
    allPetActionSlots.forEach((slot) => {
      const group = materialGroupForSlot(slot);
      groups.set(group, [...(groups.get(group) ?? []), slot]);
    });
    return Array.from(groups.entries());
  }, []);

  const runAction = async (action: () => Promise<unknown> | unknown, successMessage: string) => {
    try {
      await action();
      await refreshState();
      setStatusMessage(successMessage);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    }
  };

  const account = state.account;

  return (
    <main className="studio-app">
      <section className="studio-topbar">
        <div>
          <h1>CatDesktopPet</h1>
          <p>{account ? `${account.email} · ${account.credits} 积分` : "登录后同步网页端猫咪素材"}</p>
        </div>
        <div className="studio-topbar-actions">
          {account ? (
            <button onClick={() => void runAction(() => bridge?.signOut?.(), "已退出账号。")}>退出</button>
          ) : null}
          <button onClick={() => void runAction(() => bridge?.sync?.(), "已同步网页端素材。")} disabled={!account}>
            同步
          </button>
        </div>
      </section>

      {!account ? (
        <section className="studio-panel login-panel">
          <h2>登录账号</h2>
          <p>Windows 端负责显示、同步、好友寄养和召回；素材生成继续在网页端完成。</p>
          <label>
            邮箱
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密码
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          <button
            className="primary-action"
            onClick={() => void runAction(() => bridge?.signIn?.(email, password), "登录成功。")}
          >
            登录
          </button>
        </section>
      ) : null}

      <section className="studio-grid">
        <div className="studio-panel">
          <div className="panel-heading">
            <h2>桌面宠物</h2>
            <span>{state.petCount} 只</span>
          </div>
          <div className="segmented-row">
            {Array.from({ length: Math.max(state.petCount, 1) }, (_, index) => (
              <button
                key={index}
                className={index === selectedPetIndex ? "selected" : ""}
                onClick={() => {
                  setSelectedPetIndex(index);
                  setPetNameDraft(`Pet ${index + 1}`);
                }}
              >
                Pet {index + 1}
              </button>
            ))}
          </div>
          <label>
            宠物名称
            <input value={petNameDraft} onChange={(event) => setPetNameDraft(event.target.value)} />
          </label>
          <div className="button-grid">
            <button onClick={() => void runAction(() => bridge?.addPet?.(), "已添加宠物。")}>添加宠物</button>
            <button
              onClick={() =>
                void runAction(
                  () => bridge?.renamePet?.(selectedPetIndex, petNameDraft),
                  "已更新宠物名称。"
                )
              }
            >
              保存名称
            </button>
            <button onClick={() => void runAction(() => bridge?.showPets?.(), "已显示宠物。")}>
              显示
            </button>
            <button onClick={() => void runAction(() => bridge?.hidePets?.(), "已隐藏宠物。")}>
              隐藏
            </button>
            <button
              onClick={() =>
                void runAction(() => bridge?.toggleClickThrough?.(), "已切换点击穿透。")
              }
            >
              {state.isClickThrough ? "关闭穿透" : "开启穿透"}
            </button>
            <button
              onClick={() =>
                void runAction(() => bridge?.toggleMouseoverCatch?.(), "已切换鼠标抓虫。")
              }
            >
              {state.isMouseoverCatchEnabled ? "关闭抓虫" : "开启抓虫"}
            </button>
            <button onClick={() => void runAction(() => bridge?.resetPositions?.(), "已重置位置。")}>
              重置位置
            </button>
          </div>
        </div>

        <div className="studio-panel">
          <div className="panel-heading">
            <h2>好友寄养</h2>
            <span>账号功能</span>
          </div>
          <label>
            好友邮箱
            <input value={friendEmail} onChange={(event) => setFriendEmail(event.target.value)} />
          </label>
          <div className="button-grid">
            <button
              disabled={!account}
              onClick={() => void runAction(() => bridge?.refreshFriends?.(), "好友列表已刷新。")}
            >
              刷新好友
            </button>
            <button
              disabled={!account || !friendEmail.trim()}
              onClick={() => void runAction(() => bridge?.addFriend?.(friendEmail), "已添加好友。")}
            >
              添加好友
            </button>
            <button disabled={!account}>寄养选中宠物</button>
            <button disabled={!account}>召回选中宠物</button>
          </div>
        </div>
      </section>

      <section className="studio-panel material-panel">
        <div className="panel-heading">
          <h2>状态视频</h2>
          <span>Pet {selectedPetIndex + 1}</span>
        </div>
        <div className="material-groups">
          {groupedSlots.map(([group, slots]) => (
            <section className="material-group" key={group}>
              <h3>{materialGroupTitles[group]}</h3>
              <div className="material-list">
                {slots.map((slot) => (
                  <div className="material-row" key={slot}>
                    <span>{petActionSlotDisplayName(slot)}</span>
                    <div>
                      <button
                        onClick={() =>
                          void runAction(
                            () => bridge?.importVideo?.(selectedPetIndex, slot),
                            `已导入「${petActionSlotDisplayName(slot)}」。`
                          )
                        }
                      >
                        导入
                      </button>
                      <button
                        onClick={() =>
                          void runAction(
                            () => bridge?.removeVideo?.(selectedPetIndex, slot),
                            `已移除「${petActionSlotDisplayName(slot)}」。`
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {statusMessage ? <p className="status-line">{statusMessage}</p> : null}
    </main>
  );
}
