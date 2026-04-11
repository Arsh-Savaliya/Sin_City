import { html } from "../lib/html.js";
import { PressureHeatmap } from "../components/graphs/PressureHeatmap.js";
import { Panel, PageIntro, Badge } from "../components/sections/common.js";
import { clampPercent } from "../utils/dashboard.js";

export function PressureMapPage({ analytics, dashboard }) {
  const pressureEntries = Object.entries(analytics?.crimePressure || {}).sort((left, right) => right[1] - left[1]);
  const hottestDistrict = pressureEntries[0];
  const peopleById = new Map((dashboard?.people || []).map((person) => [person._id, person.name]));

  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="Pressure Map"
        subtitle="Heat, instability, and cross-faction pressure points rendered as a live operational board."
        aside=${hottestDistrict &&
        html`
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Hottest District</p>
          <p className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-blood">${hottestDistrict[0]}</p>
        `}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <${Panel} eyebrow="Heat & Instability" title="Crime Pressure">
          <${PressureHeatmap} pressure=${analytics?.crimePressure || {}} />
        </${Panel}>

        <${Panel} eyebrow="District Signals" title="Pressure Stack">
          <div className="space-y-3">
            ${pressureEntries.map(
              ([district, value], index) => html`
                <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base font-semibold text-white">${district}</h4>
                    <${Badge} tone=${index === 0 ? "high" : index === 1 ? "medium" : "low"}>
                      ${value} Incidents
                    </${Badge}>
                  </div>
                  <p className="mt-2 text-sm text-white/60">
                    Pressure concentration at ${Math.max(15, Math.round((value / (hottestDistrict?.[1] || value || 1)) * 100))}% of current peak activity.
                  </p>
                </article>
              `
            )}
          </div>
        </${Panel}>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <${Panel} eyebrow="Corruption Bridges" title="Illegal Protection Routes">
          <div className="space-y-3">
            ${(analytics?.corruptionClusters || []).map(
              (cluster) => html`
                <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
                      ${peopleById.get(cluster.sourceId) || cluster.sourceId} → ${peopleById.get(cluster.targetId) || cluster.targetId}
                    </p>
                    <${Badge} tone=${cluster.tensionScore >= 75 ? "high" : "medium"}>
                      Tension ${cluster.tensionScore}
                    </${Badge}>
                  </div>
                  <p className="mt-2 text-sm text-white/58">
                    Weighted corruption channel with strength ${cluster.weight}. Elevated pressure if a raid or betrayal hits this edge.
                  </p>
                </article>
              `
            )}
          </div>
        </${Panel}>

        <${Panel} eyebrow="Pressure Consequences" title="Latest Trigger Events">
          <div className="space-y-3">
            ${(dashboard?.events || []).slice(0, 6).map(
              (event) => html`
                <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base font-semibold text-white">${event.headline}</h4>
                    <span className="text-xs uppercase tracking-[0.18em] text-white/40">${event.type}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/62">${event.summary}</p>
                </article>
              `
            )}
          </div>
        </${Panel}>
      </div>

      <${Panel} eyebrow="Forecast" title="Pressure Outlook">
        <div className="grid gap-4 md:grid-cols-3">
          ${[
            {
              label: "Solved Rate",
              value: `${clampPercent(analytics?.summary?.solvedRate || 0)}%`
            },
            {
              label: "Next Flashpoint",
              value: analytics?.unstableHierarchies?.[0]?.faction || "Unknown"
            },
            {
              label: "Dominance Drift",
              value: analytics?.nextDominantPlayer?.name || "Unknown"
            }
          ].map(
            (card) => html`
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <p className="eyebrow-tag">${card.label}</p>
                <p className="mt-3 font-display text-3xl uppercase tracking-[0.12em] text-white">${card.value}</p>
              </div>
            `
          )}
        </div>
      </${Panel}>
    </div>
  `;
}
