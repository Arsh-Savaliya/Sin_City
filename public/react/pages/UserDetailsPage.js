import { React, html } from "../lib/html.js";
import { Panel, PageIntro, Badge, ToggleSwitch } from "../components/sections/common.js";

const { useEffect, useState } = React;

export function UserDetailsPage({
  userProfile,
  selectedNode,
  simulation,
  actions
}) {
  const [statusValue, setStatusValue] = useState(selectedNode?.status || "alive");

  useEffect(() => {
    setStatusValue(selectedNode?.status || "alive");
  }, [selectedNode?._id, selectedNode?.status]);

  async function handleStatusChange() {
    if (!selectedNode?._id) {
      return;
    }

    try {
      await actions.updatePersonStatus(selectedNode._id, statusValue);
    } catch (error) {
      window.alert(error.message);
    }
  }

  return html`
    <div className="space-y-8">
      <${PageIntro}
        title="User Details"
        subtitle="Operator identity, live simulation controls, and selected-node intervention tools."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <${Panel} eyebrow="Operator Profile" title=${userProfile?.name || "J. Marlowe"}>
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="rounded-[1.8rem] border border-blood/20 bg-gradient-to-b from-blood/[0.18] to-transparent p-6">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-blood/35 bg-black/75 text-3xl font-display text-white">
                ${(userProfile?.name || "JM")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/45">${userProfile?.role || "Field Analyst"}</p>
              <p className="mt-3 font-display text-4xl uppercase tracking-[0.12em] text-white">${userProfile?.division || "Intelligence Unit"}</p>
              <p className="mt-4 text-sm text-white/62">${userProfile?.quote}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              ${detailCard("Clearance", userProfile?.clearance || "Crimson-7")}
              ${detailCard("Location", userProfile?.location || "Sin City Central")}
              ${detailCard("Simulation", simulation?.isRunning ? "Active" : "Paused")}
              ${detailCard("Narrative Mode", simulation?.narrativeMode || "local-only")}
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Focus Areas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              ${(userProfile?.focus || []).map(
                (item) => html`<${Badge} tone="neutral">${item}</${Badge}>`
              )}
            </div>
          </div>
        </${Panel}>

        <div className="space-y-6">
          <${Panel} eyebrow="Selected Node" title=${selectedNode?.name || "No Character Selected"}>
            ${selectedNode
              ? html`
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-blood">${selectedNode.rank || selectedNode.role}</p>
                      <p className="mt-2 text-sm text-white/62">${selectedNode.backgroundSummary || selectedNode.notes || "No dossier summary."}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      ${detailCard("Dominance", Math.round(selectedNode.dominanceScore || 0), true)}
                      ${detailCard("Power", selectedNode.powerLevel || 0)}
                      ${detailCard("Fear", selectedNode.fearFactor || 0)}
                      ${detailCard("Loyalty", selectedNode.loyaltyScore || 0)}
                    </div>
                    <label className="input-shell">
                      <span>Status</span>
                      <select
                        value=${statusValue}
                        onChange=${(event) => setStatusValue(event.target.value)}
                        className="input-element"
                      >
                        <option value="alive">alive</option>
                        <option value="dead">dead</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className="action-pill" onClick=${handleStatusChange}>Apply Status</button>
                      <button type="button" className="action-pill secondary" onClick=${() => actions.promoteCharacter(selectedNode._id)}>
                        Promote
                      </button>
                      <button type="button" className="action-pill danger" onClick=${() => actions.eliminateCharacter(selectedNode._id)}>
                        Eliminate
                      </button>
                    </div>
                  </div>
                `
              : html`
                  <p className="text-sm text-white/52">
                    Select a node from the network or hierarchy views to manage its status here.
                  </p>
                `}
          </${Panel}>

          <${Panel} eyebrow="Tracking" title="Realtime Controls">
            <div className="space-y-3">
              <${ToggleSwitch}
                label="Simulation Running"
                hint="Pause or resume the live underworld engine."
                checked=${Boolean(simulation?.isRunning)}
                onChange=${(value) => actions.toggleSimulation(value)}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="action-pill" onClick=${() => actions.runSimulationTick("user-details-manual")}>
                Force Tick
              </button>
            </div>
          </${Panel}>
        </div>
      </div>
    </div>
  `;
}

function detailCard(label, value, accent = false) {
  return html`
    <div className=${`rounded-[1.35rem] border p-4 ${accent ? "border-blood/25 bg-blood/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-white/42">${label}</p>
      <p className="mt-3 font-display text-3xl uppercase tracking-[0.12em] text-white">${value}</p>
    </div>
  `;
}
