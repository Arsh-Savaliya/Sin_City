import { React, html } from "./lib/html.js";
import { api } from "./api/client.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { NetworkGraph } from "./components/graphs/NetworkGraph.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { Icons } from "./components/layout/icons.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { getGraphForView, viewOptions, buildMessages, formatTime } from "./utils/dashboard.js";
import { mockMessages } from "./data/mockData.js";

const { useEffect, useMemo, useState } = React;
const LEGACY_AUTH_KEYS = ["bh_token", "bh_user"];
const DEFAULT_SIMULATION_INTERVAL = 40000;

function normalizeUserProfile(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    operatorName: user.operatorName || user.username || "Operator",
    title: user.title || "Field Analyst",
    division: user.division || "Intelligence Unit"
  };
}

function statForNode(node) {
  if (!node) {
    return [];
  }

  if (node.role === "police") {
    return [
      { label: "Power", value: node.powerLevel || 0 },
      { label: "Influence", value: node.influenceScore || 0 },
      { label: "Encounters", value: node.encounters || node.cases || 0 },
      { label: "Cases Solved", value: node.casesSolved || 0 },
      { label: "Integrity", value: node.integrityScore || 0 },
      { label: "Underworld", value: node.isCorrupt ? node.underworldPower || 0 : "Clean" }
    ];
  }

  return [
    { label: "Power", value: node.powerLevel || 0 },
    { label: "Influence", value: node.influenceScore || 0 },
    { label: "Murders", value: node.murders || 0 },
    { label: "Crimes", value: node.totalCrimes || node.crimesCommitted?.length || 0 },
    { label: "Fear", value: node.fearFactor || 0 },
    { label: "Money", value: `$${Number(node.money || 0).toLocaleString("en-US")}` }
  ];
}

export function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentPage, setCurrentPage] = useState("networks");
  const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("bh_sidebar_open") !== "false");

  const { dashboard, analytics, simulation, loading, error, actions } = useDashboardData(token);

  useEffect(() => {
    LEGACY_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    localStorage.setItem("bh_sidebar_open", sidebarOpen ? "true" : "false");
  }, [sidebarOpen]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let isMounted = true;

    api
      .getCurrentUser(token)
      .then((profile) => {
        if (isMounted) {
          setUser(normalizeUserProfile(profile));
        }
      })
      .catch((profileError) => {
        console.error("Failed to hydrate user profile", profileError);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const operatorProfile = useMemo(() => normalizeUserProfile(user), [user]);
  const messages = useMemo(
    () => buildMessages(analytics, dashboard?.events, mockMessages),
    [analytics, dashboard?.events]
  );

  if (!user || !token) {
    return html`
      <${AuthScreen}
        onLogin=${(nextUser, nextToken) => {
          setUser(normalizeUserProfile(nextUser));
          setToken(nextToken);
        }}
      />
    `;
  }

  if (loading) {
    return html`
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center text-blood">
            <${Icons.triangle} className="h-10 w-10" />
          </div>
          <p className="font-display text-5xl uppercase tracking-[0.16em] text-blood">Loading</p>
          <p className="mt-3 text-sm uppercase tracking-[0.2em] text-white/50">Synchronizing the city</p>
        </div>
      </div>
    `;
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
  }

  async function handleProfileSave(profilePatch) {
    const updatedProfile = normalizeUserProfile(await api.updateCurrentUser(profilePatch, token));
    setUser(updatedProfile);
    return updatedProfile;
  }

  async function handleCulpritGuess(suspectId) {
    const result = await api.guessCulprit(suspectId, token);
    setUser(normalizeUserProfile({ ...user, ...result.user }));
    await actions.refresh();
    return result;
  }

  async function handleRestartCulpritGame() {
    const result = await api.restartCulpritGame(token);
    setSelectedNode(null);
    setUser(normalizeUserProfile({ ...user, ...result.user }));
    await actions.refresh();
    return result;
  }

  return html`
    <div className="min-h-screen bg-black text-white flex">
      <${Sidebar}
        currentPage=${currentPage}
        onNavigate=${setCurrentPage}
        userProfile=${operatorProfile}
        onLogout=${handleLogout}
        isOpen=${sidebarOpen}
        onToggle=${() => setSidebarOpen((value) => !value)}
      />

      <main className="flex-1 p-6">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick=${() => setSidebarOpen((value) => !value)}
              className="rounded-full border border-white/10 bg-white/5 p-3 text-blood transition hover:border-blood/40 hover:bg-blood/10"
              aria-label=${sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <${Icons.triangle} direction=${sidebarOpen ? "left" : "right"} className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-blood">VELVET n VICE</h1>
              <p className="text-xs uppercase tracking-widest text-white/40 mt-1">Local simulation engine</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-white/40">Operator</p>
            <p className="font-display text-xl uppercase tracking-widest">${operatorProfile?.operatorName}</p>
            <p className="text-xs uppercase tracking-[0.22em] text-white/40 mt-1">${operatorProfile?.title}</p>
          </div>
        </header>

        ${error && html`<div className="bg-blood/20 border border-blood/30 p-4 rounded mb-6 text-blood">${error}</div>`}

        ${currentPage === "networks" &&
        html`
          <${NetworksPage}
            dashboard=${dashboard}
            analytics=${analytics}
            simulation=${simulation}
            selectedNode=${selectedNode}
            setSelectedNode=${setSelectedNode}
            actions=${actions}
          />
        `}

        ${currentPage === "crime-records" && html`<${CrimeRecordsPage} dashboard=${dashboard} />`}
        ${currentPage === "messages" && html`<${MessagesPage} messages=${messages} />`}
        ${currentPage === "user-details" &&
        html`
          <${UserDetailsPage}
            userProfile=${operatorProfile}
            selectedNode=${selectedNode}
            simulation=${simulation}
            onSave=${handleProfileSave}
            dashboard=${dashboard}
            onGuessCulprit=${handleCulpritGuess}
            onRestartCulpritGame=${handleRestartCulpritGame}
          />
        `}
      </main>
    </div>
  `;
}

function NetworksPage({ dashboard, analytics, simulation, selectedNode, setSelectedNode, actions }) {
  const [view, setView] = useState("criminal");
  const [isUpdatingSimulation, setIsUpdatingSimulation] = useState(false);
  const graph = useMemo(() => getGraphForView(dashboard, view), [dashboard, view]);

  const criminals = dashboard?.people?.filter((person) => person.role === "criminal") || [];
  const police = dashboard?.people?.filter((person) => person.role === "police") || [];
  const viewNodes = view === "police" ? police : criminals;
  const rivalryLinks = graph?.links?.filter((link) => link.type === "rivalry") || [];
  const events = dashboard?.events || [];
  const selectedStats = statForNode(selectedNode);
  const viewTitle = view === "police" ? "Police Network" : view === "corruption" ? "Corruption Network" : "Criminal Network";

  async function handleSimulationToggle() {
    setIsUpdatingSimulation(true);
    try {
      await actions.toggleSimulation(!simulation?.isRunning);
    } finally {
      setIsUpdatingSimulation(false);
    }
  }

  async function handleManualTick() {
    setIsUpdatingSimulation(true);
    try {
      await actions.runSimulationTick("operator-panel");
    } finally {
      setIsUpdatingSimulation(false);
    }
  }

  return html`
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl uppercase tracking-widest">${viewTitle}</h2>
          <p className="text-sm text-white/45 mt-2">The city AI ticks every ${Math.round((simulation?.intervalMs || DEFAULT_SIMULATION_INTERVAL) / 1000)} seconds, opens cases, solves them, creates operators, kills them, and logs every move in the feed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick=${handleSimulationToggle}
            disabled=${isUpdatingSimulation}
            className=${`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] transition ${
              simulation?.isRunning
                ? "border-blood/40 bg-blood/10 text-blood"
                : "border-white/15 bg-white/5 text-white/70"
            } disabled:opacity-60`}
          >
            ${simulation?.isRunning ? "Pause AI" : "Resume AI"}
          </button>
          <button
            type="button"
            onClick=${handleManualTick}
            disabled=${isUpdatingSimulation}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/80 transition hover:border-blood/40 hover:text-blood disabled:opacity-60"
          >
            Force Tick
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
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
          <p className="font-display text-3xl text-blood">${view === "police" ? police.filter((person) => person.isCorrupt).length : criminals.filter((person) => (person.dominanceScore || 0) >= 420).length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Last Tick</p>
          <p className="font-display text-xl text-blood">${formatTime(simulation?.lastTickAt)}</p>
          <p className="mt-2 text-xs uppercase tracking-widest text-white/40">${simulation?.isRunning ? "AI active" : "AI paused"}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        ${viewOptions.map((option) => html`
          <button
            key=${option.key}
            type="button"
            onClick=${() => setView(option.key)}
            className=${`px-4 py-2 rounded text-sm uppercase ${
              view === option.key ? "bg-blood text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            ${option.label}
          </button>
        `)}
      </div>

      <div className="bg-white/5 p-4 rounded mb-6" style=${{ minHeight: "420px" }}>
        <${NetworkGraph} graph=${graph} mode=${view} selectedNode=${selectedNode} onSelectNode=${setSelectedNode} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">${view === "police" ? "Corrupt Officers" : "Top Operatives"}</h3>
          ${view === "police"
            ? (analytics?.suspiciousPolice || []).map((officer, index) => html`
                <div key=${officer._id || index} className="border-t border-white/10 py-3">
                  <p className="font-bold">${officer.name}</p>
                  <p className="text-sm text-white/50">${officer.rank} - Suspicion ${Math.round((officer.suspiciousIndex || 0) * 100)}%</p>
                </div>
              `)
            : viewNodes.slice(0, 5).map((person, index) => html`
                <div key=${person._id || index} className="border-t border-white/10 py-3">
                  <p className="font-bold">${person.name}</p>
                  <p className="text-sm text-white/50">${person.rank || person.role} - Power ${person.powerLevel || 0}</p>
                </div>
              `)}
        </div>

        <div className="bg-white/5 p-4 rounded">
          <h3 className="font-bold uppercase tracking-widest mb-3 text-blood">${selectedNode ? "Selected Node" : view === "police" ? "Clean Officers" : "Conflict Board"}</h3>
          ${selectedNode
            ? html`
                <div>
                  <p className="font-display text-xl uppercase">${selectedNode.name}</p>
                  <p className="text-white/50">${selectedNode.rank || selectedNode.role} - ${selectedNode.faction || "Independent"}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    ${selectedStats.map((item) => html`
                      <div key=${item.label} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">${item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">${item.value}</p>
                      </div>
                    `)}
                  </div>
                </div>
              `
            : view === "police"
              ? police.filter((person) => !person.isCorrupt).slice(0, 5).map((person, index) => html`
                  <div key=${person._id || index} className="border-t border-white/10 py-3">
                    <p className="font-bold">${person.name}</p>
                    <p className="text-sm text-white/50">${person.rank} - Integrity ${person.integrityScore || 0}</p>
                  </div>
                `)
              : rivalryLinks.slice(0, 5).map((link, index) => html`
                  <div key=${link._id || index} className="border-t border-white/10 py-3">
                    <p className="font-bold text-blood">Tension ${link.tensionScore || 0}</p>
                    <p className="text-sm text-white/50">A rivalry edge is heating up inside the network.</p>
                  </div>
                `)}
          ${!selectedNode && html`<p className="mt-4 text-sm text-white/45">Hover a node to inspect its live stats or click one to pin it here.</p>`}
        </div>

        <${WorldEventsPanel} events=${events} simulation=${simulation} />
      </div>
    </div>
  `;
}

function WorldEventsPanel({ events, simulation }) {
  return html`
    <section className="bg-white/5 p-4 rounded">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-bold uppercase tracking-widest text-blood">World Feed</h3>
        <span className="text-[11px] uppercase tracking-[0.24em] text-white/40">
          ${simulation?.isRunning ? "Live AI feed" : "Feed paused"}
        </span>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
        ${(events || []).length === 0
          ? html`<p className="text-sm text-white/45">The city is quiet for now.</p>`
          : events.map((event) => html`
              <article key=${event._id || `${event.headline}-${event.happenedAt}`} className=${`rounded-2xl border p-4 ${event.metadata?.culpritClue ? "border-blood/35 bg-blood/10" : "border-white/10 bg-black/30"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">${formatTime(event.happenedAt)}</p>
                  ${event.metadata?.culpritClue && html`<span className="rounded-full bg-blood/20 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-blood">Clue</span>`}
                </div>
                <p className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-blood">${event.headline}</p>
                <p className="mt-2 text-sm leading-6 text-white/70">${event.summary}</p>
              </article>
            `)}
      </div>
    </section>
  `;
}

function CrimeRecordsPage({ dashboard }) {
  const crimes = dashboard?.crimes || [];

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">Crime Records</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Total</p>
          <p className="font-display text-3xl">${crimes.length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Solved</p>
          <p className="font-display text-3xl">${crimes.filter((crime) => crime.status === "solved").length}</p>
        </div>
        <div className="bg-white/5 p-4 rounded">
          <p className="text-xs uppercase tracking-widest text-white/50">Open</p>
          <p className="font-display text-3xl text-blood">${crimes.filter((crime) => crime.status === "open").length}</p>
        </div>
      </div>

      <div className="bg-white/5 p-4 rounded">
        ${crimes.map((crime) => html`
          <div key=${crime._id || crime.crimeId} className="border-t border-white/10 py-3">
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold uppercase">${crime.crimeId}</p>
                <p>${crime.title}</p>
              </div>
              <span className=${`px-2 py-1 rounded text-xs uppercase ${
                crime.status === "solved" ? "bg-green-500/20 text-green-400" : "bg-blood/20 text-blood"
              }`}>
                ${crime.status}
              </span>
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
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">AI Feed</h2>

      <div className="bg-white/5 p-4 rounded">
        ${messages.map((message) => html`
          <div key=${message.id || message.subject} className="border-t border-white/10 py-3">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">${message.sender}</p>
                <p className="font-bold mt-1">${message.subject}</p>
              </div>
              <div className="text-right">
                <span className=${`px-2 py-1 rounded text-xs uppercase ${
                  message.priority === "high"
                    ? "bg-blood/20 text-blood"
                    : message.priority === "medium"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-white/10 text-white/50"
                }`}>
                  ${message.priority}
                </span>
                <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-white/35">${formatTime(message.timestamp)}</p>
              </div>
            </div>
            <p className="text-sm text-white/50 mt-2">${message.body}</p>
          </div>
        `)}
      </div>
    </div>
  `;
}

function UserDetailsPage({ userProfile, selectedNode, simulation, onSave, dashboard, onGuessCulprit, onRestartCulpritGame }) {
  const [formState, setFormState] = useState(() => ({
    operatorName: userProfile?.operatorName || userProfile?.username || "",
    title: userProfile?.title || "Field Analyst",
    division: userProfile?.division || "Intelligence Unit"
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [suspectId, setSuspectId] = useState("");
  const [guessMessage, setGuessMessage] = useState("");
  const [guessError, setGuessError] = useState("");
  const [isGuessing, setIsGuessing] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const culpritGame = userProfile?.culpritGame || {};
  const suspects = (dashboard?.people || []).filter((person) => person.role === "criminal" && person.status === "alive");
  const canGuess = culpritGame.status === "active" && Boolean(culpritGame.culpritInWorld);
  const canRestart = culpritGame.status === "solved" || culpritGame.status === "locked";

  useEffect(() => {
    setFormState({
      operatorName: userProfile?.operatorName || userProfile?.username || "",
      title: userProfile?.title || "Field Analyst",
      division: userProfile?.division || "Intelligence Unit"
    });
  }, [userProfile]);

  useEffect(() => {
    if (suspectId && !suspects.some((person) => person._id === suspectId)) {
      setSuspectId("");
    }
  }, [suspectId, suspects]);

  function updateFormField(field) {
    return (event) => setFormState((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      await onSave(formState);
      setSaveMessage("Operator details updated.");
    } catch (formError) {
      setSaveError(formError.message || "Unable to save operator details.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGuessSubmit(event) {
    event.preventDefault();
    if (!suspectId) {
      setGuessError("Choose a suspect first.");
      return;
    }

    setIsGuessing(true);
    setGuessError("");
    setGuessMessage("");

    try {
      const result = await onGuessCulprit(suspectId);
      setGuessMessage(result.message);
      if (result.correct || result.user?.culpritGame?.attemptsRemaining === 0) {
        setSuspectId("");
      }
    } catch (guessRequestError) {
      setGuessError(guessRequestError.message || "Guess failed.");
    } finally {
      setIsGuessing(false);
    }
  }

  async function handleRestartGame() {
    setIsRestarting(true);
    setGuessError("");
    setGuessMessage("");

    try {
      const result = await onRestartCulpritGame();
      setSuspectId("");
      setGuessMessage(result.message || "A fresh culprit hunt is now active.");
    } catch (restartError) {
      setGuessError(restartError.message || "Unable to restart the culprit hunt.");
    } finally {
      setIsRestarting(false);
    }
  }

  return html`
    <div>
      <h2 className="font-display text-3xl uppercase tracking-widest mb-6">User Details</h2>

      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit=${handleSubmit} className="bg-white/5 p-5 rounded">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blood/30 flex items-center justify-center text-2xl font-bold">
              ${(formState.operatorName || userProfile?.username || "OP")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="font-display text-2xl uppercase">${formState.operatorName || userProfile?.username}</p>
              <p className="text-white/50 uppercase text-sm">${formState.title}</p>
              <p className="text-white/50 text-sm mt-1">${formState.division}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-white/50 mb-2">Username</span>
              <input
                type="text"
                value=${userProfile?.username || ""}
                disabled=${true}
                className="w-full rounded border border-white/10 bg-white/5 px-4 py-3 text-white/45 outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-white/50 mb-2">Operator Name</span>
              <input
                type="text"
                value=${formState.operatorName}
                onChange=${updateFormField("operatorName")}
                className="w-full rounded border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-blood/50"
                placeholder=${userProfile?.username || "Operator"}
              />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-white/50 mb-2">Title</span>
              <input
                type="text"
                value=${formState.title}
                onChange=${updateFormField("title")}
                className="w-full rounded border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-blood/50"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="block text-xs uppercase tracking-widest text-white/50 mb-2">Division</span>
              <input
                type="text"
                value=${formState.division}
                onChange=${updateFormField("division")}
                className="w-full rounded border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-blood/50"
              />
            </label>
          </div>

          ${saveError && html`<p className="mt-4 rounded border border-blood/30 bg-blood/10 px-4 py-3 text-sm text-blood">${saveError}</p>`}
          ${saveMessage && html`<p className="mt-4 rounded border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">${saveMessage}</p>`}

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.22em] text-white/35">Operator name defaults to your username until you change it.</p>
            <button
              type="submit"
              disabled=${isSaving}
              className="rounded-full bg-blood px-5 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-blood/85 disabled:opacity-60"
            >
              ${isSaving ? "Saving" : "Save Details"}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="bg-white/5 p-5 rounded">
            <h3 className="font-bold uppercase tracking-widest mb-4 text-blood">Operator Snapshot</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Operator</p>
                <p className="font-display text-2xl uppercase mt-2">${userProfile?.operatorName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Division</p>
                <p className="font-display text-2xl uppercase mt-2">${userProfile?.division}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">AI Cycle</p>
                <p className="font-display text-2xl uppercase mt-2">${Math.round((simulation?.intervalMs || DEFAULT_SIMULATION_INTERVAL) / 1000)} Sec</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Last Tick</p>
                <p className="font-display text-2xl uppercase mt-2">${formatTime(simulation?.lastTickAt)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 p-5 rounded">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold uppercase tracking-widest text-blood">Culprit Guess</h3>
              <span className="rounded-full border border-blood/30 bg-blood/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-blood">
                ${culpritGame.attemptsRemaining ?? 3} attempts left
              </span>
            </div>

            <p className="mt-3 text-sm text-white/60">
              Watch the clue cards in the AI feed, compare them with the network, and name the culprit before your three guesses run out.
            </p>

            <form onSubmit=${handleGuessSubmit} className="mt-4 space-y-4">
              <div>
                <span className="block text-xs uppercase tracking-widest text-white/50 mb-2">Suspect Board</span>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-2">
                  ${suspects.length === 0
                    ? html`<p className="px-3 py-4 text-sm text-white/45">No visible criminal suspects are in the world yet.</p>`
                    : suspects.map((person) => html`
                        <button
                          key=${person._id}
                          type="button"
                          onClick=${() => setSuspectId(person._id)}
                          disabled=${!canGuess || isGuessing}
                          className=${`w-full rounded-xl border px-3 py-3 text-left transition ${
                            suspectId === person._id
                              ? "border-blood bg-blood/12 text-white"
                              : "border-white/10 bg-black/40 text-white/82 hover:border-white/20 hover:bg-white/5"
                          } disabled:cursor-not-allowed disabled:opacity-55`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">${person.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">${person.powerLevel || 0} power</span>
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                            ${person.rank || "Operator"} · ${person.faction || "Independent"}
                          </p>
                        </button>
                      `)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled=${isGuessing || !canGuess || !suspectId}
                  className="rounded-full bg-blood px-5 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:bg-blood/85 disabled:opacity-60"
                >
                  ${isGuessing ? "Checking" : "Guess Culprit"}
                </button>

                ${canRestart && html`
                  <button
                    type="button"
                    onClick=${handleRestartGame}
                    disabled=${isRestarting}
                    className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm uppercase tracking-[0.22em] text-white transition hover:border-blood/35 hover:bg-blood/10 disabled:opacity-60"
                  >
                    ${isRestarting ? "Restarting" : "Restart Hunt"}
                  </button>
                `}
              </div>
            </form>

            ${guessError && html`<p className="mt-4 rounded border border-blood/30 bg-blood/10 px-4 py-3 text-sm text-blood">${guessError}</p>`}
            ${guessMessage && html`<p className="mt-4 rounded border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">${guessMessage}</p>`}
            ${culpritGame.status !== "active" && html`
              <p className="mt-4 text-sm text-white/70">
                ${culpritGame.status === "solved"
                  ? `Case solved. Culprit: ${culpritGame.culpritRevealedName}.`
                  : `Case locked. Culprit: ${culpritGame.culpritRevealedName || "unknown"}.`}
              </p>
            `}
          </div>

          <div className="bg-white/5 p-5 rounded">
            <h3 className="font-bold uppercase tracking-widest mb-4 text-blood">Selected Node</h3>
            ${selectedNode
              ? html`
                  <div>
                    <p className="font-display text-xl uppercase">${selectedNode.name}</p>
                    <p className="text-white/50">${selectedNode.rank || selectedNode.role} - ${selectedNode.faction || "Independent"}</p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      ${statForNode(selectedNode).map((item) => html`
                        <div key=${item.label} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">${item.label}</p>
                          <p className="mt-1 text-sm font-semibold text-white">${item.value}</p>
                        </div>
                      `)}
                    </div>
                  </div>
                `
              : html`<p className="text-white/50">Select a node from Networks.</p>`}
          </div>
        </div>
      </div>
    </div>
  `;
}
