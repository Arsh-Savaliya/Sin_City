import { React, html, motion } from "../lib/html.js";
import { NetworkGraph } from "../components/graphs/NetworkGraph.js";
import { HierarchyGraph } from "../components/graphs/HierarchyGraph.js";
import { Panel, PageIntro, MetricCard, ToggleSwitch, Badge } from "../components/sections/common.js";
import { getGraphForView, getRiskLevel, mapPredictionCards, viewOptions, formatTime } from "../utils/dashboard.js";

const { useEffect, useMemo, useState } = React;

export function NetworksPage({
  dashboard,
  analytics,
  simulation,
  selectedNode,
  setSelectedNode,
  actions
}) {
  const [view, setView] = useState("criminal");
  const [surveillanceEnabled, setSurveillanceEnabled] = useState(true);
  const [riskAlertsEnabled, setRiskAlertsEnabled] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(Boolean(simulation?.isRunning));
  const [showHiddenRelations, setShowHiddenRelations] = useState(false);

  useEffect(() => {
    setTrackingEnabled(Boolean(simulation?.isRunning));
  }, [simulation?.isRunning]);

  const graph = useMemo(() => getGraphForView(dashboard, view), [dashboard, view]);
  const predictions = useMemo(() => mapPredictionCards(analytics), [analytics]);
  const summaryCards = [
    {
      label: "Total Nodes",
      value: analytics?.summary?.nodeCount || 0,
      detail: "Tracked people across criminal and police worlds"
    },
    {
      label: "Connections",
      value: analytics?.summary?.edgeCount || 0,
      detail: "Active visible ties in the current ecosystem"
    },
    {
      label: "High Value Targets",
      value: dashboard?.people?.filter((person) => (person.dominanceScore || 0) >= 420).length || 0,
      detail: "Dominance-heavy actors drawing attention"
    },
    {
      label: "Active Conflicts",
      value:
        graph?.links?.filter((link) => link.type === "rivalry" || (link.tensionScore || 0) >= 75).length || 0,
      detail: "Edges close to betrayal or violence"
    }
  ];

  async function syncTracking(nextValue) {
    setTrackingEnabled(nextValue);
    try {
      await actions.toggleSimulation(nextValue);
    } catch (error) {
      window.alert(error.message);
      setTrackingEnabled(!nextValue);
    }
  }

  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="Criminal Network"
        subtitle="A living noir intelligence board for shifting loyalties, corruption bridges, and sudden ascents to power."
        aside=${html`
          <p className="font-semibold uppercase tracking-[0.16em] text-white">Live Mode</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/50">
            ${simulation?.narrativeMode || "local-only"} / ${simulation?.isRunning ? "Tracking active" : "Tracking paused"}
          </p>
        `}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_360px]">
        <div className="space-y-5">
          <${Panel}
            eyebrow="Primary View"
            title="Criminal Network"
            className="overflow-hidden"
          >
            <div className="mb-5 flex flex-wrap gap-3">
              ${viewOptions.map(
                (option) => html`
                  <button
                    key=${option.key}
                    type="button"
                    onClick=${() => setView(option.key)}
                    className=${`view-toggle ${view === option.key ? "is-active" : ""}`}
                  >
                    ${option.label}
                  </button>
                `
              )}
            </div>

            <${motion.div}
              key=${view}
              initial=${{ opacity: 0, y: 24 }}
              animate=${{ opacity: 1, y: 0 }}
              transition=${{ duration: 0.35, ease: "easeOut" }}
            >
              ${view === "hierarchy"
                ? html`
                    <${HierarchyGraph}
                      root=${dashboard?.views?.hierarchy}
                      onSelectNode=${setSelectedNode}
                    />
                  `
                : html`
                    <${NetworkGraph}
                      graph=${graph}
                      mode=${view}
                      hiddenRelations=${analytics?.hiddenRelationships || []}
                      revealHiddenRelations=${showHiddenRelations}
                      selectedNode=${selectedNode}
                      onSelectNode=${setSelectedNode}
                    />
                  `}
            </${motion.div}>
          </${Panel}>

          <div className="grid gap-6 xl:grid-cols-2">
            <${Panel} eyebrow="AI Surveillance" title="Suspicious Officers">
              <div className="space-y-3">
                ${(analytics?.suspiciousPolice || []).map(
                  (officer) => html`
                    <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 transition duration-300 hover:border-blood/25 hover:bg-blood/[0.06]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-lg font-semibold text-white">${officer.name}</h4>
                          <p className="text-xs uppercase tracking-[0.18em] text-white/45">${officer.rank}</p>
                        </div>
                        <${Badge} tone=${getRiskLevel(officer.suspiciousIndex || 0).toLowerCase()}>
                          ${getRiskLevel(officer.suspiciousIndex || 0)}
                        </${Badge}>
                      </div>
                      <p className="mt-3 text-sm text-white/62">
                        ${officer.reason ||
                        `Integrity ${officer.integrityScore}. Suspicion index ${Math.round(
                          (officer.suspiciousIndex || 0) * 100
                        )}%.`}
                      </p>
                    </article>
                  `
                )}
              </div>
            </${Panel}>

            <${Panel} eyebrow="AI Predictions" title="Predicted Events">
              <div className="space-y-3">
                ${predictions.map(
                  (prediction) => html`
                    <article className="rounded-[1.5rem] border border-blood/25 bg-blood/[0.08] p-4 shadow-ember">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-lg font-semibold uppercase tracking-[0.12em] text-white">${prediction.title}</h4>
                        <span className="text-2xl font-display uppercase tracking-[0.12em] text-blood">${prediction.probability}%</span>
                      </div>
                      <p className="mt-3 text-sm text-white/68">${prediction.description}</p>
                    </article>
                  `
                )}
              </div>
            </${Panel}>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <${Panel} eyebrow="System Controls" title="Signal Controls">
              <div className="space-y-3">
                <${ToggleSwitch}
                  label="Enable Surveillance"
                  hint="Keep suspicious-officer feeds visible in every refresh."
                  checked=${surveillanceEnabled}
                  onChange=${setSurveillanceEnabled}
                />
                <${ToggleSwitch}
                  label="Activate Risk Alerts"
                  hint="Emphasize imminent fractures and high-risk predictions."
                  checked=${riskAlertsEnabled}
                  onChange=${setRiskAlertsEnabled}
                />
                <${ToggleSwitch}
                  label="Real-time Tracking"
                  hint="Pause or resume the live simulation engine."
                  checked=${trackingEnabled}
                  onChange=${syncTracking}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="action-pill" onClick=${() => actions.runSimulationTick("manual-noir-dashboard")}>
                  Run Event Tick
                </button>
                ${selectedNode &&
                html`
                  <button type="button" className="action-pill secondary" onClick=${() => actions.promoteCharacter(selectedNode._id)}>
                    Promote ${selectedNode.name.split(" ")[0]}
                  </button>
                  <button type="button" className="action-pill danger" onClick=${() => actions.eliminateCharacter(selectedNode._id)}>
                    Eliminate ${selectedNode.name.split(" ")[0]}
                  </button>
                `}
              </div>
            </${Panel}>

            <${Panel} eyebrow="Hidden Relations" title="Secret Connections">
              <button
                type="button"
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-blood/25 hover:text-blood"
                onClick=${() => setShowHiddenRelations(!showHiddenRelations)}
              >
                ${showHiddenRelations ? "Hide" : "Reveal"} Hidden Relations
              </button>

              <${motion.div}
                initial=${false}
                animate=${{ height: showHiddenRelations ? "auto" : 0, opacity: showHiddenRelations ? 1 : 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  ${(analytics?.hiddenRelationships || []).map(
                    (relation) => html`
                      <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-base font-semibold text-white">${relation.sourceName} → ${relation.targetName}</h4>
                          <${Badge} tone="medium">${Math.round((relation.confidence || 0) * 100)}%</${Badge}>
                        </div>
                        <p className="mt-2 text-sm text-white/62">${relation.reason}</p>
                      </article>
                    `
                  )}
                </div>
              </${motion.div}>
            </${Panel}>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            ${summaryCards.map(
              (card, index) => html`
                <${MetricCard}
                  key=${card.label}
                  label=${card.label}
                  value=${card.value}
                  detail=${card.detail}
                  accent=${index === 0}
                />
              `
            )}
          </div>

          <${Panel} eyebrow="Selected Target" title=${selectedNode ? selectedNode.name : "No Target Selected"}>
            ${selectedNode
              ? html`
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-blood">${selectedNode.rank || selectedNode.role}</p>
                      <p className="mt-2 text-sm text-white/68">${selectedNode.backgroundSummary || selectedNode.notes || "No dossier copy on file."}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      ${statChip("Dominance", Math.round(selectedNode.dominanceScore || 0))}
                      ${statChip("Power", selectedNode.powerLevel || 0)}
                      ${statChip("Influence", selectedNode.influenceScore || 0)}
                      ${statChip("Status", selectedNode.status || "alive")}
                    </div>
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/62">
                      ${selectedNode.backstory || "No backstory on file."}
                    </div>
                  </div>
                `
              : html`
                  <p className="text-sm text-white/52">
                    Click a node in the graph to reveal the dossier, power profile, and current danger level.
                  </p>
                `}
          </${Panel}>

          <${Panel} eyebrow="Recent Shockwaves" title="Timeline">
            <div className="space-y-3">
              ${(dashboard?.events || []).slice(0, 5).map(
                (event) => html`
                  <article className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white">${event.headline}</p>
                      <${Badge} tone=${event.type === "takeover" || event.type === "assassination" ? "high" : "neutral"}>
                        ${event.type}
                      </${Badge}>
                    </div>
                    <p className="mt-2 text-sm text-white/60">${event.summary}</p>
                    <p className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-white/35">${formatTime(event.happenedAt)}</p>
                  </article>
                `
              )}
            </div>
          </${Panel}>
        </aside>
      </section>
    </div>
  `;
}

function statChip(label, value) {
  return html`
    <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-white/42">${label}</p>
      <p className="mt-2 font-display text-2xl uppercase tracking-[0.1em] text-white">${value}</p>
    </div>
  `;
}
