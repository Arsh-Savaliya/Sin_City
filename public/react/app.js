import { React, html } from "./lib/html.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { NetworkGraph } from "./components/graphs/NetworkGraph.js";
import { HierarchyGraph } from "./components/graphs/HierarchyGraph.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { getGraphForView, viewOptions, clampPercent, buildMessages } from "./utils/dashboard.js";
import { mockMessages, mockUserProfile } from "./data/mockData.js";

const { useEffect, useMemo, useState } = React;

export function App() {
  const { dashboard, analytics, simulation, loading, error, actions } = useDashboardData();
  const [currentPage, setCurrentPage] = useState("networks");
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const people = dashboard?.people || [];
  const matchedNode = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return people.find((person) =>
      [person.name, person.alias, person.rank, person.faction]
        .filter(Boolean).join(" ").toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }, [people, searchQuery]);

  function handleSearch(e) {
    e.preventDefault();
    if (matchedNode) {
      setSelectedNode(matchedNode);
      setCurrentPage("user-details");
    }
  }

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

  return html`
    <div className="min-h-screen bg-black text-white flex">
      <${Sidebar}
        currentPage=${currentPage}
        onNavigate=${setCurrentPage}
        userProfile=${mockUserProfile}
      />

      <main className="flex-1 p-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Welcome Back</p>
            <h1 className="font-display text-4xl uppercase tracking-widest">J. Marlowe</h1>
          </div>
          <form onSubmit=${handleSearch} className="flex gap-2">
            <input
              value=${searchQuery}
              onChange=${(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-white/10 border border-white/20 px-4 py-2 rounded text-white placeholder-white/50"
            />
            <button type="submit" className="bg-blood px-4 py-2 rounded uppercase text-sm">Search</button>
          </form>
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

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Criminal Network</h2>
      
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Nodes</p>
          <p className="font-display text-3xl">${analytics?.summary?.nodeCount || 0}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Edges</p>
          <p className="font-display text-3xl">${analytics?.summary?.edgeCount || 0}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Targets</p>
          <p className="font-display text-3xl text-blood">${dashboard?.people?.filter((p) => (p.dominanceScore || 0) >= 420).length || 0}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Conflicts</p>
          <p className="font-display text-3xl text-blood">${graph?.links?.filter((l) => l.type === "rivalry").length || 0}</p>
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
        <${NetworkGraph} graph=${graph} mode=${view} selectedNode=${selectedNode} onSelectNode=${setSelectedNode} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Suspicious Officers</h3>
          ${(analytics?.suspiciousPolice || []).map((officer, i) => html`
            <div key=${officer._id || i} className="border-t border-white/10 py-2">
              <p className="font-bold">${officer.name}</p>
              <p className="text-sm text-white/50">${officer.rank} - Suspicion: ${Math.round((officer.suspiciousIndex || 0) * 100)}%</p>
            </div>
          `)}
        </div>

        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">Predictions</h3>
          ${analytics?.likelyBetrayal && html`
            <div key="betrayal" className="border-t border-white/10 py-2">
              <p className="font-bold">${analytics.likelyBetrayal.name}</p>
              <p className="text-sm text-white/50">High betrayal risk</p>
            </div>
          `}
          ${analytics?.nextDominantPlayer && html`
            <div key="successor" className="border-t border-white/10 py-2">
              <p className="font-bold">${analytics.nextDominantPlayer.name}</p>
              <p className="text-sm text-white/50">Potential successor</p>
            </div>
          `}
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