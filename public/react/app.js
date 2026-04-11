import { React, html, AnimatePresence, motion } from "./lib/html.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { Icons } from "./components/layout/icons.js";
import { NetworksPage } from "./pages/NetworksPage.js";
import { PressureMapPage } from "./pages/PressureMapPage.js";
import { HierarchiesPage } from "./pages/HierarchiesPage.js";
import { CrimeRecordsPage } from "./pages/CrimeRecordsPage.js";
import { MessagesPage } from "./pages/MessagesPage.js";
import { UserDetailsPage } from "./pages/UserDetailsPage.js";
import { buildMessages } from "./utils/dashboard.js";
import { mockMessages, mockUserProfile } from "./data/mockData.js";

const { Navigate, Route, Routes, useLocation, useNavigate } = window.ReactRouterDOM;
const { useEffect, useMemo, useState } = React;

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { dashboard, analytics, simulation, loading, error, usingMockData, actions } = useDashboardData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const messages = useMemo(
    () => buildMessages(analytics, dashboard?.events, mockMessages),
    [analytics, dashboard?.events]
  );

  const people = dashboard?.people || [];
  const matchedNode = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return null;
    }
    return people.find((person) =>
      [person.name, person.alias, person.rank, person.faction]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [people, searchQuery]);

  useEffect(() => {
    if (!selectedNode?._id) {
      return;
    }

    const freshNode = people.find((person) => person._id === selectedNode._id);
    if (freshNode) {
      setSelectedNode(freshNode);
    }
  }, [people, selectedNode?._id]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (!matchedNode) {
      return;
    }
    setSelectedNode(matchedNode);
    navigate("/user-details");
  }

  const sidebarWidth = collapsed ? 92 : 280;

  return html`
    <div className="dashboard-root" style=${{ "--sidebar-width": `${sidebarWidth}px` }}>
      <div className="ambient-noise"></div>
      <div className="city-halo"></div>
      <div className="city-silhouette"></div>

      <${Sidebar}
        collapsed=${collapsed}
        mobileOpen=${mobileOpen}
        setCollapsed=${setCollapsed}
        setMobileOpen=${setMobileOpen}
        userProfile=${mockUserProfile}
      />

      ${mobileOpen &&
      html`<button type="button" className="mobile-backdrop lg:hidden" onClick=${() => setMobileOpen(false)}></button>`}

      <main className="dashboard-main">
        <header className="topbar-shell">
          <div className="flex items-center gap-3">
            <button type="button" className="sidebar-toggle lg:hidden" onClick=${() => setMobileOpen(true)}>
              ${Icons.menu()}
            </button>
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.3em] text-white/35">Welcome Back</p>
              <h2 className="font-display text-4xl uppercase tracking-[0.12em] text-white">J. Marlowe</h2>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 xl:flex-row xl:items-center">
            <form onSubmit=${handleSearchSubmit} className="search-shell">
              <input
                value=${searchQuery}
                onChange=${(event) => setSearchQuery(event.target.value)}
                className="search-input"
                placeholder="Search target, case, or location..."
              />
              <button type="submit" className="search-button" aria-label="Search">
                ${Icons.search()}
              </button>
            </form>
            <div className="flex items-center gap-3">
              <span className="status-orb"></span>
              <div className="text-right">
                <p className="text-[0.65rem] uppercase tracking-[0.24em] text-white/40">
                  ${simulation?.isRunning ? "Realtime Tracking" : "Tracking Paused"}
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-blood">
                  ${simulation?.narrativeMode || "local-only"}
                </p>
              </div>
            </div>
          </div>
        </header>

        ${error &&
        html`
          <div className="mx-6 rounded-[1.4rem] border border-blood/25 bg-blood/[0.08] px-4 py-3 text-sm text-white/75">
            ${error}
            ${usingMockData ? " Showing fallback noir data while live services recover." : ""}
          </div>
        `}

        ${loading
          ? html`
              <div className="flex min-h-[60vh] items-center justify-center px-6">
                <div className="rounded-[2rem] border border-white/10 bg-black/70 px-8 py-8 text-center shadow-panel">
                  <p className="font-display text-5xl uppercase tracking-[0.16em] text-blood">Loading</p>
                  <p className="mt-3 text-sm uppercase tracking-[0.2em] text-white/50">Synchronizing the city</p>
                </div>
              </div>
            `
          : html`
              <section className="content-shell">
                <${AnimatePresence} mode="wait">
                  <${motion.div}
                    key=${location.pathname}
                    initial=${{ opacity: 0, y: 26 }}
                    animate=${{ opacity: 1, y: 0 }}
                    exit=${{ opacity: 0, y: -18 }}
                    transition=${{ duration: 0.3, ease: "easeOut" }}
                  >
                    <${Routes}>
                      <${Route}
                        path="/"
                        element=${html`<${Navigate} to="/networks" replace=${true} />`}
                      />
                      <${Route}
                        path="/networks"
                        element=${html`
                          <${NetworksPage}
                            dashboard=${dashboard}
                            analytics=${analytics}
                            simulation=${simulation}
                            selectedNode=${selectedNode}
                            setSelectedNode=${setSelectedNode}
                            actions=${actions}
                          />
                        `}
                      />
                      <${Route}
                        path="/pressure-map"
                        element=${html`<${PressureMapPage} analytics=${analytics} dashboard=${dashboard} />`}
                      />
                      <${Route}
                        path="/unstable-hierarchies"
                        element=${html`
                          <${HierarchiesPage}
                            dashboard=${dashboard}
                            analytics=${analytics}
                            selectedNode=${selectedNode}
                            setSelectedNode=${setSelectedNode}
                          />
                        `}
                      />
                      <${Route}
                        path="/crime-records"
                        element=${html`<${CrimeRecordsPage} dashboard=${dashboard} actions=${actions} />`}
                      />
                      <${Route}
                        path="/messages"
                        element=${html`<${MessagesPage} messages=${messages} />`}
                      />
                      <${Route}
                        path="/user-details"
                        element=${html`
                          <${UserDetailsPage}
                            userProfile=${mockUserProfile}
                            selectedNode=${selectedNode || matchedNode}
                            simulation=${simulation}
                            actions=${actions}
                          />
                        `}
                      />
                    </${Routes}>
                  </${motion.div}>
                </${AnimatePresence}>
              </section>
            `}
      </main>
    </div>
  `;
}
