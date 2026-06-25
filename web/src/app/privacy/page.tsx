import type { Metadata } from "next";
import {
  privacyBoundaryItems,
  privacyHighlights,
  privacyMetadata,
  privacySections
} from "@/lib/privacy-page";

export const metadata: Metadata = {
  title: "隐私说明 | DesktopPet Studio",
  description: "了解 DesktopPet Studio 和桌面端会同步哪些数据，以及不会读取哪些桌面隐私内容。"
};

export default function PrivacyPage() {
  return (
    <main className="privacy-shell">
      <header className="topbar privacy-topbar">
        <a className="brand privacy-brand" href="/" aria-label="返回 DesktopPet Studio 首页">
          <div className="brand-mark">🐱</div>
          <div>
            <h1>DesktopPet Studio</h1>
          </div>
        </a>
        <a className="button secondary" href="/">
          返回首页
        </a>
      </header>

      <section className="privacy-hero">
        <span className="eyebrow">Privacy</span>
        <h2>{privacyMetadata.title}</h2>
        <p>
          这份说明用直接的方式解释 DesktopPet Studio 和桌面端如何工作、会同步哪些数据，
          以及我们不会读取哪些与你桌面隐私有关的内容。
        </p>
        <span className="privacy-updated">最后更新：{privacyMetadata.lastUpdated}</span>
      </section>

      <section className="privacy-highlights" aria-label="隐私重点">
        {privacyHighlights.map((item) => (
          <article className="privacy-highlight" key={item.title}>
            <span>{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="privacy-boundary-panel" aria-label="我们不会读取的内容">
        <div>
          <span className="eyebrow">明确边界</span>
          <h3>我们不会读取这些内容</h3>
        </div>
        <ul>
          {privacyBoundaryItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <article className="privacy-document">
        {privacySections.map((section) => (
          <section className="privacy-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </main>
  );
}
