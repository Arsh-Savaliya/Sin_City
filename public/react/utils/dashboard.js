export const viewOptions = [
  { key: "criminal", label: "Criminal Network" },
  { key: "police", label: "Police Network" },
  { key: "hierarchy", label: "Hierarchy Graph" },
  { key: "corruption", label: "Corruption Graph" }
];

export function getGraphForView(dashboard, view) {
  const fallback = { nodes: [], links: [] };
  if (!dashboard?.views) {
    return fallback;
  }

  if (view === "criminal") {
    return dashboard.views.criminalNetwork || fallback;
  }

  if (view === "police") {
    return dashboard.views.policeNetwork || fallback;
  }

  if (view === "corruption") {
    return dashboard.views.corruptionNetwork || fallback;
  }

  if (view === "power") {
    return dashboard.views.powerNetwork || fallback;
  }

  return fallback;
}

export function getRiskLevel(score = 0) {
  if (score >= 0.75 || score >= 75) {
    return "High";
  }
  if (score >= 0.45 || score >= 45) {
    return "Medium";
  }
  return "Low";
}

export function clampPercent(value = 0, scale = 1) {
  const ratio = scale === 1 ? value : value / scale;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function getInfluenceColor(node) {
  const dominance = node?.dominanceScore || 0;
  const influence = node?.influenceScore || 0;
  if (node?.status === "dead") {
    return "#505050";
  }
  if (dominance >= 460 || influence >= 70) {
    return "#ff2a2a";
  }
  if (dominance < 220 || influence < 35) {
    return "#6a6a6a";
  }
  return "#f5f5f5";
}

export function initials(name = "?") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function formatTime(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleString();
}

export function mapPredictionCards(analytics) {
  const predictions = [];

  if (analytics?.nextDominantPlayer) {
    predictions.push({
      id: "next-dominant",
      title: "Next Dominant Player",
      description: `${analytics.nextDominantPlayer.name} is positioned to dominate the next shift.`,
      probability: clampPercent(analytics.nextDominantPlayer.risePotential || 0.74)
    });
  }

  if (analytics?.likelyBetrayal) {
    predictions.push({
      id: "likely-betrayal",
      title: "Likely Betrayal",
      description: `${analytics.likelyBetrayal.name} shows the sharpest betrayal pattern in the network.`,
      probability: clampPercent(analytics.likelyBetrayal.betrayalRisk || 0.67)
    });
  }

  const unstable = analytics?.unstableHierarchies?.[0];
  if (unstable) {
    predictions.push({
      id: "unstable-faction",
      title: "Hierarchy Fracture",
      description: `${unstable.faction} is drifting into a power vacuum.`,
      probability: clampPercent(unstable.instabilityScore || 0.61)
    });
  }

  return predictions;
}

export function buildMessages(analytics, events, mockMessages) {
  const eventMessages = (events || []).slice(0, 4).map((event) => ({
    id: event._id,
    sender: "Event Engine",
    subject: event.headline,
    body: event.summary,
    priority:
      event.type === "assassination" || event.type === "takeover" || event.type === "elimination"
        ? "high"
        : "medium",
    timestamp: event.happenedAt
  }));

  const surveillanceMessages = (analytics?.suspiciousPolice || []).slice(0, 2).map((officer) => ({
    id: `${officer._id || officer.name}-watch`,
    sender: "AI Surveillance",
    subject: `${officer.name} flagged`,
    body:
      officer.reason ||
      `${officer.name} has entered the corruption watchlist with a ${getRiskLevel(
        officer.suspiciousIndex || 0
      )} risk profile.`,
    priority: getRiskLevel(officer.suspiciousIndex || 0).toLowerCase(),
    timestamp: new Date().toISOString()
  }));

  return [...eventMessages, ...surveillanceMessages, ...mockMessages].slice(0, 8);
}
