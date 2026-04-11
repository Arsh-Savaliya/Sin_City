import { html, motion } from "../../lib/html.js";

export function Panel({ title, eyebrow, children, className = "" }) {
  return html`
    <section className=${`panel-shell ${className}`.trim()}>
      ${(title || eyebrow) &&
      html`
        <header className="mb-4 flex items-end justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            ${eyebrow && html`<p className="eyebrow-tag">${eyebrow}</p>`}
            ${title && html`<h3 className="section-heading">${title}</h3>`}
          </div>
        </header>
      `}
      ${children}
    </section>
  `;
}

export function PageIntro({ title, subtitle, aside }) {
  return html`
    <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="eyebrow-tag">Sin City Intelligence</p>
        <h1 className="page-title">${title}</h1>
        <p className="max-w-3xl text-sm text-white/58 sm:text-base">${subtitle}</p>
      </div>
      ${aside &&
      html`
        <div className="rounded-2xl border border-blood/20 bg-white/[0.03] px-4 py-3 text-sm text-white/65 shadow-ember">
          ${aside}
        </div>
      `}
    </div>
  `;
}

export function ToggleSwitch({ label, checked, onChange, hint }) {
  return html`
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">${label}</p>
        ${hint && html`<p className="mt-1 text-xs text-white/45">${hint}</p>`}
      </div>
      <button
        type="button"
        onClick=${() => onChange(!checked)}
        className=${`toggle-switch ${checked ? "is-on" : ""}`}
        aria-pressed=${checked}
      >
        <span></span>
      </button>
    </label>
  `;
}

export function MetricCard({ label, value, accent = false, detail }) {
  return html`
    <${motion.article}
      layout
      className=${`rounded-[1.4rem] border px-4 py-4 shadow-panel backdrop-blur ${
        accent ? "border-blood/35 bg-blood/[0.07]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="eyebrow-tag !text-[0.6rem]">${label}</p>
      <p className="mt-3 font-display text-4xl uppercase tracking-[0.12em] text-white">${value}</p>
      ${detail && html`<p className="mt-2 text-xs text-white/55">${detail}</p>`}
    </${motion.article}>
  `;
}

export function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "border-white/12 bg-white/[0.04] text-white/70",
    high: "border-blood/35 bg-blood/[0.12] text-blood",
    medium: "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
    low: "border-white/12 bg-white/[0.05] text-white/55"
  };

  return html`
    <span className=${`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${tones[tone] || tones.neutral}`}>
      ${children}
    </span>
  `;
}
