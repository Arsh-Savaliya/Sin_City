import { api } from "./api.js";
import { renderForceGraph } from "./graphs/forceGraph.js";
import { renderTreeGraph } from "./graphs/treeGraph.js";
import { renderHeatmap } from "./graphs/heatmap.js";

const state = {
  dashboard: null,
  analytics: null,
  simulation: null,
  revealObserver: null,
  view: "criminal",
  filters: {
    search: "",
    role: "all"
  },
  selectedNode: null,
  timelineCutoff: Date.now()
};

const dom = {
  graphContainer: document.getElementById("graphContainer"),
  tooltip: document.getElementById("tooltip"),
  metricGrid: document.getElementById("metricGrid"),
  profilePanel: document.getElementById("profilePanel"),
  suspiciousPolice: document.getElementById("suspiciousPolice"),
  hiddenRelationships: document.getElementById("hiddenRelationships"),
  aiPredictions: document.getElementById("aiPredictions"),
  unstableHierarchies: document.getElementById("unstableHierarchies"),
  eventTimeline: document.getElementById("eventTimeline"),
  heatmap: document.getElementById("heatmap"),
  searchInput: document.getElementById("searchInput"),
  roleFilter: document.getElementById("roleFilter"),
  graphTabs: document.getElementById("graphTabs"),
  statusForm: document.getElementById("statusForm"),
  statusPersonSelect: document.getElementById("statusPersonSelect"),
  statusValue: document.getElementById("statusValue"),
  crimeForm: document.getElementById("crimeForm"),
  crimeCommittedBy: document.getElementById("crimeCommittedBy"),
  crimeSolvedBy: document.getElementById("crimeSolvedBy"),
  crimeTable: document.getElementById("crimeTable"),
  crimeStatusForm: document.getElementById("crimeStatusForm"),
  crimeStatusId: document.getElementById("crimeStatusId"),
  crimeStatusValue: document.getElementById("crimeStatusValue"),
  crimeSolvedByStatus: document.getElementById("crimeSolvedByStatus"),
  timelineRange: document.getElementById("timelineRange"),
  timelineLabel: document.getElementById("timelineLabel"),
  refreshButton: document.getElementById("refreshButton"),
  toggleSimulationButton: document.getElementById("toggleSimulationButton"),
  runTickButton: document.getElementById("runTickButton"),
  simulationStatus: document.getElementById("simulationStatus"),
  promoteButton: document.getElementById("promoteButton"),
  eliminateButton: document.getElementById("eliminateButton"),
  storyOverlay: document.getElementById("storyOverlay")
};

const socket = io();

async function init() {
  bindEvents();
  setupInteractionAnimations();
  await loadDashboard();
  socket.emit("dashboard:refresh");
}

function bindEvents() {
  dom.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderCurrentView();
  });

  dom.roleFilter.addEventListener("change", (event) => {
    state.filters.role = event.target.value;
    renderCurrentView();
  });

  dom.graphTabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (!tab) {
      return;
    }
    document.querySelectorAll(".tab").forEach((element) => element.classList.remove("active"));
    tab.classList.add("active");
    state.view = tab.dataset.view;
    renderCurrentView();
  });

  dom.statusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.updatePersonStatus(dom.statusPersonSelect.value, dom.statusValue.value);
    } catch (error) {
      window.alert(error.message);
    }
  });

  dom.crimeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      crimeId: formData.get("crimeId"),
      title: formData.get("title"),
      category: formData.get("category"),
      district: formData.get("district"),
      occurredAt: formData.get("occurredAt"),
      evidence: formData.get("evidence"),
      summary: formData.get("summary"),
      status: formData.get("status"),
      solvedBy: formData.get("solvedBy") || undefined,
      committedBy: Array.from(dom.crimeCommittedBy.selectedOptions).map((option) => option.value)
    };

    try {
      await api.createCrime(payload);
      event.currentTarget.reset();
    } catch (error) {
      window.alert(error.message);
    }
  });

  dom.crimeStatusForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.updateCrime(dom.crimeStatusId.value, {
        status: dom.crimeStatusValue.value,
        solvedBy: dom.crimeSolvedByStatus.value || null
      });
    } catch (error) {
      window.alert(error.message);
    }
  });

  dom.timelineRange.addEventListener("input", () => {
    updateTimelineCutoff();
    renderCurrentView();
  });

  dom.refreshButton.addEventListener("click", () => socket.emit("dashboard:refresh"));

  dom.toggleSimulationButton.addEventListener("click", async () => {
    const next = !state.simulation?.isRunning;
    await api.toggleSimulation(next);
    await refreshSimulationState();
  });

  dom.runTickButton.addEventListener("click", async () => {
    await api.runSimulationTick("manual-ui");
    await refreshSimulationState();
  });

  dom.promoteButton.addEventListener("click", async () => {
    if (!state.selectedNode?._id) {
      window.alert("Select a node first.");
      return;
    }
    await api.promoteCharacter(state.selectedNode._id);
  });

  dom.eliminateButton.addEventListener("click", async () => {
    if (!state.selectedNode?._id) {
      window.alert("Select a node first.");
      return;
    }
    await api.eliminateCharacter(state.selectedNode._id);
  });

  socket.on("graph:refresh", ({ graph, analytics, reason }) => {
    const previousLatestEventId = state.dashboard?.events?.[0]?._id;
    state.dashboard = graph;
    state.analytics = analytics;
    updateTimelineCutoff();
    hydrateControls();
    renderScene();
    if (reason?.includes("simulation")) {
      refreshSimulationState().catch(() => {});
    }

    const latestEvent = graph.events?.[0];
    if (latestEvent && latestEvent._id !== previousLatestEventId) {
      triggerStoryOverlay(latestEvent, reason);
    }
  });

  socket.on("system:error", ({ message }) => {
    window.alert(message);
  });

  window.addEventListener("resize", debounce(renderCurrentView, 120));
}

async function loadDashboard() {
  const [dashboard, analytics, simulation] = await Promise.all([
    api.getDashboard(),
    api.getAnalytics(),
    api.getSimulationState()
  ]);
  state.dashboard = dashboard;
  state.analytics = analytics;
  state.simulation = simulation;
  updateTimelineCutoff();
  hydrateControls();
  renderScene();
  renderSimulationStatus();
}

async function refreshSimulationState() {
  state.simulation = await api.getSimulationState();
  renderSimulationStatus();
}

function renderScene() {
  renderMetrics();
  renderCurrentView();
  renderProfile(state.selectedNode);
  renderSuspiciousPolice();
  renderHiddenRelationships();
  renderPredictions();
  renderUnstableHierarchies();
  renderEventTimeline();
  renderHeatmap(dom.heatmap, state.analytics?.crimePressure);
  renderCrimeTable();
  registerRevealTargets();
}

function renderMetrics() {
  const analytics = state.analytics;
  if (!analytics) {
    return;
  }

  const cards = [
    ["Nodes", analytics.summary.nodeCount],
    ["Connections", analytics.summary.edgeCount],
    ["Crimes", analytics.summary.crimeCount],
    ["Top boss", analytics.mostInfluential?.name || "Unknown"],
    ["Next rise", analytics.nextDominantPlayer?.name || "Unknown"]
  ];

  dom.metricGrid.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="metric-card">
          <p class="eyebrow">${label}</p>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
}

function renderCurrentView() {
  if (!state.dashboard) {
    return;
  }

  const views = state.dashboard.views;
  const powerGraph = views.powerNetwork;
  const criminalGraph = views.criminalNetwork;
  const policeGraph = views.policeNetwork;
  const corruptionGraph = filteredByTimeline(views.corruptionNetwork);

  if (state.view === "hierarchy") {
    renderTreeGraph({
      container: dom.graphContainer,
      root: views.hierarchy,
      onNodeSelect: selectNode
    });
    return;
  }

  const graph =
    state.view === "criminal"
      ? filteredByTimeline(criminalGraph)
      : state.view === "power"
        ? filteredByTimeline(powerGraph)
        : state.view === "police"
          ? filteredByTimeline(policeGraph)
          : corruptionGraph;

  renderForceGraph({
    container: dom.graphContainer,
    tooltip: dom.tooltip,
    graph,
    onNodeSelect: selectNode,
    filters: state.filters,
    timelineCutoff: state.timelineCutoff,
    mode: state.view
  });
}

function filteredByTimeline(view) {
  return {
    nodes: view.nodes,
    links: view.links.filter((link) => {
      const startedAt = new Date(link.startedAt || Date.now()).getTime();
      return startedAt <= state.timelineCutoff;
    })
  };
}

function selectNode(node) {
  state.selectedNode = node;
  renderProfile(node);
}

function renderProfile(node) {
  if (!node) {
    dom.profilePanel.className = "profile-content empty";
    dom.profilePanel.textContent =
      "Select a node to inspect power, fear, heirs, criminal record, and live status.";
    return;
  }

  dom.profilePanel.className = "profile-content";
  dom.profilePanel.innerHTML = `
    <div>
      <p class="eyebrow">${node.role} profile</p>
      <h4 class="text-3xl font-display tracking-[0.14em]">${node.name}</h4>
      <p class="text-zinc-400">${node.alias || node.rank || "No alias on file"}</p>
      <p class="text-zinc-300">${node.notes || "No narrative notes on file."}</p>
    </div>
    <div class="profile-grid">
      ${profileStat("Faction", node.faction || "Independent")}
      ${profileStat("Rank", node.rank || "Unknown")}
      ${profileStat("Dominance", Math.round(node.dominanceScore || 0))}
      ${profileStat("Power", node.powerLevel || 0)}
      ${profileStat("Background", node.backgroundTier || "unknown")}
      ${profileStat("Loyalty", node.loyaltyScore || 0)}
      ${profileStat("Ambition", node.ambitionLevel || 0)}
      ${profileStat("Fear", node.fearFactor || 0)}
      ${profileStat("Intelligence", node.intelligenceLevel || 0)}
    </div>
    <div class="list-card">
      <h4>Background</h4>
      <p>${node.backgroundSummary || "No background profile on file."}</p>
    </div>
    <div class="list-card">
      <h4>Backstory</h4>
      <p>${node.backstory || "No backstory on file."}</p>
    </div>
    <div class="list-card">
      <h4>Weakness tags</h4>
      <p>${(node.weaknessTags || []).join(", ") || "No clear weakness profile."}</p>
    </div>
  `;
}

function profileStat(label, value) {
  return `
    <div class="profile-stat">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderSuspiciousPolice() {
  dom.suspiciousPolice.innerHTML = (state.analytics?.suspiciousPolice || [])
    .map(
      (officer) => `
        <article class="list-card">
          <h4>${officer.name}</h4>
          <p>${officer.rank} | Integrity ${officer.integrityScore}</p>
          <p>Suspicion index ${(officer.suspiciousIndex * 100).toFixed(0)}%</p>
        </article>
      `
    )
    .join("");
}

function renderHiddenRelationships() {
  dom.hiddenRelationships.innerHTML = (state.analytics?.hiddenRelationships || [])
    .map(
      (item) => `
        <article class="list-card">
          <h4>${item.sourceName} <-> ${item.targetName}</h4>
          <p>${item.reason}</p>
          <p>Confidence ${(item.confidence * 100).toFixed(0)}%</p>
        </article>
      `
    )
    .join("");
}

function renderPredictions() {
  const cards = [
    state.analytics?.nextDominantPlayer
      ? {
          title: "Next dominant player",
          copy: `${state.analytics.nextDominantPlayer.name} is best positioned to rise.`
        }
      : null,
    state.analytics?.likelyBetrayal
      ? {
          title: "Most likely betrayal",
          copy: `${state.analytics.likelyBetrayal.name} carries the highest betrayal risk.`
        }
      : null,
    {
      title: "Corruption clusters",
      copy: `${(state.analytics?.corruptionClusters || []).length} corruption bridge(s) are active.`
    }
  ].filter(Boolean);

  dom.aiPredictions.innerHTML = cards
    .map(
      (card) => `
        <article class="list-card">
          <h4>${card.title}</h4>
          <p>${card.copy}</p>
        </article>
      `
    )
    .join("");
}

function renderUnstableHierarchies() {
  dom.unstableHierarchies.innerHTML = (state.analytics?.unstableHierarchies || [])
    .map(
      (entry) => `
        <article class="list-card">
          <h4>${entry.faction}</h4>
          <p>Instability ${(entry.instabilityScore * 100).toFixed(0)}%</p>
          <p>${entry.hasLivingBoss ? "Boss alive" : "No living boss"} | ${entry.memberCount} members</p>
        </article>
      `
    )
    .join("");
}

function renderEventTimeline() {
  dom.eventTimeline.innerHTML = (state.dashboard?.events || [])
    .map(
      (event) => `
        <article class="timeline-item">
          <p class="eyebrow">${event.type}</p>
          <h4>${event.headline}</h4>
          <p>${event.summary}</p>
          <p>${new Date(event.happenedAt).toLocaleString()}</p>
        </article>
      `
    )
    .join("");
}

function hydrateControls() {
  const people = state.dashboard?.people || [];
  const crimes = state.dashboard?.crimes || [];

  const personOptions = people
    .map((person) => `<option value="${person._id}">${person.name} | ${person.role}</option>`)
    .join("");
  const policeOptions = people
    .filter((person) => person.role === "police")
    .map((person) => `<option value="${person._id}">${person.name}</option>`)
    .join("");
  const criminalOptions = people
    .filter((person) => person.role === "criminal")
    .map((person) => `<option value="${person._id}">${person.name}</option>`)
    .join("");
  const crimeOptions = crimes
    .map((crime) => `<option value="${crime._id}">${crime.crimeId} | ${crime.title}</option>`)
    .join("");

  dom.statusPersonSelect.innerHTML = personOptions;
  dom.crimeCommittedBy.innerHTML = criminalOptions;
  dom.crimeSolvedBy.innerHTML = `<option value="">Unsolved</option>${policeOptions}`;
  dom.crimeSolvedByStatus.innerHTML = `<option value="">Solved by nobody</option>${policeOptions}`;
  dom.crimeStatusId.innerHTML = crimeOptions;
}

function renderCrimeTable() {
  dom.crimeTable.innerHTML = (state.dashboard?.crimes || [])
    .map((crime) => {
      const committedBy = (crime.committedBy || []).map((person) => person.name).join(", ");
      const solvedBy = crime.solvedBy?.name || "No officer assigned";
      return `
        <article class="crime-row">
          <header>
            <strong>${crime.crimeId}</strong>
            <span class="status-pill ${crime.status}">${crime.status}</span>
          </header>
          <p><strong>${crime.title}</strong> | ${crime.category}</p>
          <p>Committed by: ${committedBy || "Unknown"}</p>
          <p>Solved by: ${solvedBy}</p>
          <p>District: ${crime.district || "Unknown"}</p>
          <p>Evidence: ${crime.evidence || "None"}</p>
          <p>${crime.summary || ""}</p>
        </article>
      `;
    })
    .join("");
}

function renderSimulationStatus() {
  if (!state.simulation) {
    return;
  }
  const population = state.simulation.population || {};
  dom.simulationStatus.textContent =
    `Simulation ${state.simulation.isRunning ? "running" : "paused"}` +
    `${state.simulation.narrativeMode ? ` | AI ${state.simulation.narrativeMode}` : ""}` +
    `${state.simulation.lastTickAt ? ` | Last tick ${new Date(state.simulation.lastTickAt).toLocaleTimeString()}` : ""}` +
    `${population.generatedCount !== undefined ? ` | Joined ${population.generatedCount} / Killed ${population.killCount} / Surplus ${population.surplus} (${population.pressure})` : ""}`;
  dom.toggleSimulationButton.textContent = state.simulation.isRunning ? "Pause Simulation" : "Resume Simulation";
}

function updateTimelineCutoff() {
  const relationships = [
    ...(state.dashboard?.views?.criminalNetwork?.links || []),
    ...(state.dashboard?.views?.policeNetwork?.links || []),
    ...(state.dashboard?.views?.corruptionNetwork?.links || [])
  ];
  const timestamps = relationships.map((link) => new Date(link.startedAt || Date.now()).getTime());
  if (!timestamps.length) {
    state.timelineCutoff = Date.now();
    dom.timelineLabel.textContent = "All activity";
    return;
  }

  const sorted = [...timestamps].sort((a, b) => a - b);
  const ratio = Number(dom.timelineRange.value) / 100;
  const index = Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio));
  state.timelineCutoff = sorted[index];
  dom.timelineLabel.textContent =
    ratio >= 0.99 ? "All activity" : `Through ${new Date(state.timelineCutoff).toLocaleString()}`;
}

function triggerStoryOverlay(event, reason) {
  const label =
    event.type === "succession"
      ? `New Boss: ${event.actor?.name || event.headline}`
      : event.type === "assassination" || event.type === "elimination"
        ? `${event.target?.name || event.headline} Falls`
        : event.type === "emergence"
          ? `${event.actor?.name || event.headline} Rises`
        : reason?.includes("simulation")
          ? event.headline
          : "";

  if (!label) {
    return;
  }

  dom.storyOverlay.textContent = label;
  dom.storyOverlay.classList.remove("hidden");
  requestAnimationFrame(() => dom.storyOverlay.classList.add("visible"));
  window.setTimeout(() => {
    dom.storyOverlay.classList.remove("visible");
    window.setTimeout(() => dom.storyOverlay.classList.add("hidden"), 450);
  }, 1800);
}

function setupInteractionAnimations() {
  document.addEventListener("click", (event) => {
    const directInteractive = event.target.closest(".action-button, .tab");
    if (event.target.closest("input, select, textarea") && !directInteractive) {
      return;
    }

    const target = event.target.closest(
      ".action-button, .tab, .metric-card, .list-card, .profile-stat, .crime-row, .timeline-item"
    );

    if (!target) {
      return;
    }

    target.classList.remove("press-pop");
    void target.offsetWidth;
    target.classList.add("press-pop");
    spawnRipple(target, event);
  });

  setupRevealObserver();
}

function setupRevealObserver() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  state.revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible", "scroll-glow");
        window.setTimeout(() => entry.target.classList.remove("scroll-glow"), 900);
        state.revealObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px"
    }
  );
}

function registerRevealTargets() {
  const revealTargets = document.querySelectorAll(
    ".hero-panel, .metric-card, .graph-stage, .info-panel, .records-layout, .crime-row, .timeline-item"
  );

  revealTargets.forEach((element, index) => {
    if (element.dataset.revealBound === "true") {
      return;
    }

    element.dataset.revealBound = "true";
    element.classList.add("reveal-on-scroll");
    element.style.setProperty("--reveal-delay", `${Math.min(index * 45, 240)}ms`);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !state.revealObserver) {
      element.classList.add("is-visible");
      return;
    }

    state.revealObserver.observe(element);
  });
}

function spawnRipple(target, event) {
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "click-ripple";

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  target.appendChild(ripple);
  window.setTimeout(() => ripple.remove(), 720);
}

function debounce(fn, delay = 150) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}

init().catch((error) => {
  console.error(error);
  dom.graphContainer.innerHTML = `<p class="text-red-400">Failed to load dashboard: ${error.message}</p>`;
});
