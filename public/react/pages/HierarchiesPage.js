import { html } from "../lib/html.js";
import { HierarchyGraph } from "../components/graphs/HierarchyGraph.js";
import { Panel, PageIntro, Badge } from "../components/sections/common.js";
import { clampPercent } from "../utils/dashboard.js";

export function HierarchiesPage({ dashboard, analytics, selectedNode, setSelectedNode }) {
  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="Unstable Hierarchies"
        subtitle="Boss chains, succession risk, and faction fracture points laid bare."
        aside=${html`
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Top Instability</p>
          <p className="mt-2 font-display text-3xl uppercase tracking-[0.12em] text-blood">
            ${analytics?.unstableHierarchies?.[0]?.faction || "None"}
          </p>
        `}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <${Panel} eyebrow="Command Structure" title="Hierarchy Graph">
          <${HierarchyGraph} root=${dashboard?.views?.hierarchy} onSelectNode=${setSelectedNode} />
        </${Panel}>

        <div className="space-y-6">
          <${Panel} eyebrow="Faction Volatility" title="Instability Scores">
            <div className="space-y-3">
              ${(analytics?.unstableHierarchies || []).map(
                (entry) => html`
                  <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-semibold text-white">${entry.faction}</h4>
                      <${Badge} tone=${entry.instabilityScore >= 0.7 ? "high" : "medium"}>
                        ${clampPercent(entry.instabilityScore || 0)}%
                      </${Badge}>
                    </div>
                    <p className="mt-2 text-sm text-white/58">
                      ${entry.hasLivingBoss ? "Living boss in place." : "No living boss."} ${entry.memberCount} active members.
                    </p>
                  </article>
                `
              )}
            </div>
          </${Panel}>

          <${Panel} eyebrow="Selected Node" title=${selectedNode?.name || "Choose a Node"}>
            ${selectedNode
              ? html`
                  <div className="space-y-3 text-sm text-white/65">
                    <p><span className="text-white">Rank:</span> ${selectedNode.rank || selectedNode.role}</p>
                    <p><span className="text-white">Faction:</span> ${selectedNode.faction || "Independent"}</p>
                    <p><span className="text-white">Loyalty:</span> ${selectedNode.loyaltyScore || 0}</p>
                    <p><span className="text-white">Ambition:</span> ${selectedNode.ambitionLevel || 0}</p>
                    <p><span className="text-white">Intelligence:</span> ${selectedNode.intelligenceLevel || 0}</p>
                    <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                      ${selectedNode.backgroundSummary || "No background summary."}
                    </div>
                  </div>
                `
              : html`<p className="text-sm text-white/55">Click any node in the hierarchy to inspect its position in the succession chain.</p>`}
          </${Panel}>
        </div>
      </div>
    </div>
  `;
}
