import { React, html } from "./lib/html.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { NetworkGraph } from "./components/graphs/NetworkGraph.js";
import { HierarchyGraph } from "./components/graphs/HierarchyGraph.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { getGraphForView, viewOptions, clampPercent, buildMessages } from "./utils/dashboard.js";
import { mockMessages, mockUserProfile } from "./data/mockData.js";

const { useEffect, useMemo, useState } = React;

export function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("bh_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("bh_token"));

  const { dashboard, analytics, simulation, loading, error, actions } = useDashboardData(token);
  const [currentPage, setCurrentPage] = useState("networks");
  const [selectedNode, setSelectedNode] = useState(null);

  // Show auth screen if not logged in
  if (!user || !token) {
    return html`<${AuthScreen} onLogin=${(u, t) => { setUser(u); setToken(t); }} />`;
  }

  // Show loading while fetching data
  if (loading) {
    return html`
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-5xl uppercase tracking-[0.16em] text-blood">Loading</p>
          <p className="mt-3 text-sm uppercase tracking-[0.2em] text-white/50">Synchronizing the city</p>
        </div>
      </div>
    `;
  }

  const people = dashboard?.people || [];

  function handleLogout() {
    localStorage.removeItem("bh_token");
    localStorage.removeItem("bh_user");
    setUser(null);
    setToken(null);
  }

  return html`
    <div className="min-h-screen bg-black text-white flex">
      <${Sidebar}
        currentPage=${currentPage}
        onNavigate=${setCurrentPage}
        userProfile=${user}
        onLogout=${handleLogout}
      />

      <main className="flex-1 p-6">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="font-display text-3xl uppercase tracking-widest text-blood">Black Horizon</h1>
            <p className="text-xs uppercase tracking-widest text-white/40 mt-1">Intelligence Unit</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-white/40">Operator</p>
            <p className="font-display text-xl uppercase tracking-widest">J. Marlowe</p>
          </div>
        </header>

        ${error && html`<div className="bg-blood/20 border border-blood/30 p-4 rounded mb-6 text-blood">${error}</div>`}

        ${currentPage === "networks" && html`
          <${NetworksPage}
            dashboard=${dashboard}
            analytics=${analytics}
            simulation=${simulation}
            selectedNode=${selectedNode}
            setSelectedNode=${setSelectedNode}
            actions=${actions}
          />
        `}

        ${currentPage === "pressure-map" && html`
          <${PressureMapPage} analytics=${analytics} dashboard=${dashboard} />
        `}

        ${currentPage === "unstable-hierarchies" && html`
          <${HierarchiesPage}
            dashboard=${dashboard}
            analytics=${analytics}
            selectedNode=${selectedNode}
            setSelectedNode=${setSelectedNode}
          />
        `}

        ${currentPage === "crime-records" && html`
          <${CrimeRecordsPage} dashboard=${dashboard} />
        `}

        ${currentPage === "messages" && html`
          <${MessagesPage} messages=${mockMessages} />
        `}

        ${currentPage === "user-details" && html`
          <${UserDetailsPage}
            userProfile=${mockUserProfile}
            selectedNode=${selectedNode}
            simulation=${simulation}
            actions=${actions}
          />
        `}
      </main>
    </div>
  `;
}

function NetworksPage({ dashboard, analytics, simulation, selectedNode, setSelectedNode, actions }) {
  const [view, setView] = useState("criminal");
  const [trackingEnabled, setTrackingEnabled] = useState(Boolean(simulation?.isRunning));

  useEffect(() => {
    setTrackingEnabled(Boolean(simulation?.isRunning));
  }, [simulation?.isRunning]);

  const graph = useMemo(() => getGraphForView(dashboard, view), [dashboard, view]);

  // Get stats based on view
  const criminals = dashboard?.people?.filter(p => p.role === "criminal") || [];
  const police = dashboard?.people?.filter(p => p.role === "police") || [];
  const viewNodes = view === "police" ? police : criminals;
  const corruptionLinks = graph?.links?.filter(l => l.type === "corruption") || [];
  const rivalryLinks = graph?.links?.filter(l => l.type === "rivalry") || [];

  const viewTitle = view === "police" ? "Police Network" : view === "hierarchy" ? "Power Hierarchy" : "Criminal Network";

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">${viewTitle}</h2>
       
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">${view === "police" ? "Officers" : "Members"}</p>
          <p className="font-display text-3xl">${viewNodes.length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Connections</p>
          <p className="font-display text-3xl">${graph?.links?.length || 0}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">${view === "police" ? "Corrupt" : "High Value"}</p>
          <p className="font-display text-3xl text-blood">${view === "police" ? police.filter(p => p.isCorrupt).length : criminals.filter(p => (p.dominanceScore || 0) >= 420).length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">${view === "police" ? "Clean" : "Conflicts"}</p>
          <p className="font-display text-3xl text-blood">${view === "police" ? police.filter(p => !p.isCorrupt).length : rivalryLinks.length}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        ${viewOptions.map((opt) => html`
          <button
            key=${opt.key}
            type="button"
            onClick=${() => setView(opt.key)}
            className=${`px-4 py-2 rounded text-sm uppercase ${
              view === opt.key ? "bg-blood text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            ${opt.label}
          </button>
        `)}
      </div>

      <div className="bg-white/5 p-4 rounded mb-6" style=${{ minHeight: "400px" }}>
        ${view === "hierarchy"
          ? html`<${HierarchyGraph} root=${dashboard?.views?.hierarchy} onSelectNode=${setSelectedNode} />`
          : html`<${NetworkGraph} graph=${graph} mode=${view} selectedNode=${selectedNode} onSelectNode=${setSelectedNode} />`
        }
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">${view === "police" ? "Corrupt Officers" : "Top operatives"}</h3>
          ${view === "police" 
            ? (analytics?.suspiciousPolice || []).map((officer, i) => html`
              <div key=${officer._id || i} className="border-t border-white/10 py-2">
                <p className="font-bold">${officer.name}</p>
                <p className="text-sm text-white/50">${officer.rank} - Suspicion: ${Math.round((officer.suspiciousIndex || 0) * 100)}%</p>
              </div>
            `)
            : viewNodes.slice(0, 5).map((p, i) => html`
              <div key=${p._id || i} className="border-t border-white/10 py-2">
                <p className="font-bold">${p.name}</p>
                <p className="text-sm text-white/50">${p.rank || p.role} - Power: ${p.powerLevel || 0}</p>
              </div>
            `)
          }
        </div>

        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">${view === "police" ? "Clean Officers" : "Rivalries"}</h3>
          ${view === "police"
            ? police.filter(p => !p.isCorrupt).slice(0, 5).map((p, i) => html`
              <div key=${p._id || i} className="border-t border-white/10 py-2">
                <p className="font-bold">${p.name}</p>
                <p className="text-sm text-white/50">${p.rank} - Integrity: ${p.integrityScore || 0}</p>
              </div>
            `)
            : rivalryLinks.slice(0, 5).map((l, i) => html`
              <div key=${l._id || i} className="border-t border-white/10 py-2">
                <p className="font-bold text-blood">Tension: ${l.tensionScore || 0}</p>
                <p className="text-sm text-white/50">High risk conflict</p>
              </div>
            `)
          }
        </div>
      </div>
    </div>
  `;
}

function PressureMapPage({ analytics, dashboard }) {
  const pressureEntries = Object.entries(analytics?.crimePressure || {}).sort((a, b) => b[1] - a[1]);

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Pressure Map</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        ${pressureEntries.map(([district, value], i) => html`
          <div key=${district} className=${`p-4 rounded ${i === 0 ? "bg-blood/20 border border-blood/30" : "bg-white/5 border border-white/10"}`}>
            <p className="text-xs uppercase tracking-widest text-white/50">${district}</p>
            <p className="font-display text-3xl">${value}</p>
          </div>
        `)}
      </div>

      <div className="bg-white/5 p-4 rounded">
        <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Corruption Clusters</h3>
        ${(analytics?.corruptionClusters || []).length === 0 
          ? html`<p className="text-white/50">No corruption clusters detected.</p>`
          : (analytics?.corruptionClusters || []).map((c, i) => html`
            <div key=${c.sourceId || i} className="border-t border-white/10 py-2 flex justify-between">
              <span>Node connection</span>
              <span className="text-blood">Tension: ${c.tensionScore}</span>
            </div>
          `)
        }
      </div>
    </div>
  `;
}

function HierarchiesPage({ dashboard, analytics, selectedNode, setSelectedNode }) {
  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Unstable Hierarchies</h2>
      
      <div className="bg-white/5 p-4 rounded mb-6" style=${{ minHeight: "300px" }}>
        <${HierarchyGraph} root=${dashboard?.views?.hierarchy} onSelectNode=${setSelectedNode} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Instability Scores</h3>
          ${(analytics?.unstableHierarchies || []).map((entry, i) => html`
            <div key=${entry.faction || i} className="border-t border-white/10 py-2 flex justify-between">
              <span>${entry.faction}</span>
              <span className="text-blood">${clampPercent(entry.instabilityScore)}%</span>
            </div>
          `)}
        </div>

        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Selected Node</h3>
          ${selectedNode ? html`
            <div>
              <p className="font-bold">${selectedNode.name}</p>
              <p className="text-white/50">${selectedNode.rank || selectedNode.role} - ${selectedNode.faction || "Independent"}</p>
            </div>
          ` : html`<p className="text-white/50">Select a node from the hierarchy.</p>`}
        </div>
      </div>
    </div>
  `;
}

function CrimeRecordsPage({ dashboard }) {
  const crimes = dashboard?.crimes || [];

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Crime Records</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Total</p>
          <p className="font-display text-3xl">${crimes.length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Solved</p>
          <p className="font-display text-3xl">${crimes.filter(c => c.status === "solved").length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Open</p>
          <p className="font-display text-3xl text-blood">${crimes.filter(c => c.status === "open").length}</p>
        </div>
      </div>

      <div className="bg-white/5 p-4 rounded">
        ${crimes.map((crime) => html`
          <div key=${crime._id || crime.crimeId} className="border-t border-white/10 py-3">
            <div className="flex justify-between">
              <div>
                <p className="font-bold uppercase">${crime.crimeId}</p>
                <p>${crime.title}</p>
              </div>
              <span className=${`px-2 py-1 rounded text-xs uppercase ${
                crime.status === "solved" ? "bg-green-500/20 text-green-400" : "bg-blood/20 text-blood"
              }`}>${crime.status}</span>
            </div>
            <p className="text-sm text-white/50 mt-1">${crime.summary}</p>
          </div>
        `)}
      </div>
    </div>
  `;
}

function MessagesPage({ messages }) {
  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Messages</h2>
      
      <div className="bg-white/5 p-4 rounded">
        ${messages.map((msg) => html`
          <div key=${msg.id || msg.subject} className="border-t border-white/10 py-3">
            <div className="flex justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">${msg.sender}</p>
                <p className="font-bold mt-1">${msg.subject}</p>
              </div>
              <span className=${`px-2 py-1 rounded text-xs uppercase ${
                msg.priority === "high" ? "bg-blood/20 text-blood" : msg.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/50"
              }`}>${msg.priority}</span>
            </div>
            <p className="text-sm text-white/50 mt-2">${msg.body}</p>
          </div>
        `)}
      </div>
    </div>
  `;
}

function UserDetailsPage({ userProfile, selectedNode, simulation, actions }) {
  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">User Details</h2>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Operator Profile</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blood/30 flex items-center justify-center text-2xl font-bold">
              ${(userProfile?.name || "JM").split(" ").map(p => p[0]).join("").slice(0,2)}
            </div>
            <div>
              <p className="font-display text-2xl uppercase">${userProfile?.name || "J. Marlowe"}</p>
              <p className="text-white/50 uppercase text-sm">${userProfile?.role || "Field Analyst"}</p>
              <p className="text-white/50 text-sm mt-1">${userProfile?.division || "Intelligence Unit"}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Selected Node</h3>
          ${selectedNode ? html`
            <div>
              <p className="font-display text-xl uppercase">${selectedNode.name}</p>
              <p className="text-white/50">${selectedNode.rank || selectedNode.role} - ${selectedNode.faction || "Independent"}</p>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <div className="text-center"><p className="text-xs text-white/50">DOM</p><p className="font-bold text-blood">${Math.round(selectedNode.dominanceScore || 0)}</p></div>
                <div className="text-center"><p className="text-xs text-white/50">PWR</p><p className="font-bold">${selectedNode.powerLevel || 0}</p></div>
                <div className="text-center"><p className="text-xs text-white/50">FER</p><p className="font-bold">${selectedNode.fearFactor || 0}</p></div>
                <div className="text-center"><p className="text-xs text-white/50">LOY</p><p className="font-bold">${selectedNode.loyaltyScore || 0}</p></div>
              </div>
            </div>
          ` : html`<p className="text-white/50">Select a node from Networks.</p>`}
        </div>
      </div>
    </div>
  `;
}