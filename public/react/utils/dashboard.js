export const viewOptions = [
  { key: "criminal", label: "Network" },
  { key: "corruption", label: "Corruption" },
  { key: "police", label: "Police" }
];

export function getGraphForView(dashboard, view) {
  if (!dashboard) {
    return { nodes: [], links: [] };
  }

  const viewMap = {
    criminal: dashboard.views?.criminalNetwork,
    corruption: dashboard.views?.corruptionNetwork,
    police: dashboard.views?.policeNetwork
  };

  return viewMap[view] || { nodes: [], links: [] };
}

export function getRiskLevel(index) {
  if (index >= 0.7) {
    return "HIGH";
  }
  if (index >= 0.4) {
    return "MEDIUM";
  }
  return "LOW";
}

export function mapPredictionCards(analytics) {
  if (!analytics) {
    return [];
  }

  const predictions = [];

  if (analytics.likelyBetrayal) {
    predictions.push({
      title: analytics.likelyBetrayal.name,
      description: `High ambition (${analytics.likelyBetrayal.ambitionLevel}) with low loyalty (${analytics.likelyBetrayal.loyaltyScore}) signals potential betrayal.`,
      probability: Math.round((analytics.likelyBetrayal.betrayalRisk || 0.65) * 100)
    });
  }

  if (analytics.nextDominantPlayer) {
    predictions.push({
      title: analytics.nextDominantPlayer.name,
      description: `Rising power with high ambition and strong intelligence profile. Ready for ascension.`,
      probability: Math.round((analytics.nextDominantPlayer.risePotential || 0.55) * 100)
    });
  }

  return predictions;
}

export function formatTime(dateString) {
  if (!dateString) {
    return "Unknown";
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function buildMessages(analytics, events, mockMessages) {
  const messages = [...(mockMessages || [])];

  if (events && events.length > 0) {
    events.forEach((event) => {
      let priority = "low";
      if (["assassination", "takeover", "elimination"].includes(event.type)) {
        priority = "high";
      } else if (["betrayal", "alliance", "crime", "investigation", "recalibration", "raid"].includes(event.type)) {
        priority = "medium";
      }

      messages.push({
        id: event._id || `evt-${Date.now()}`,
        sender: event.metadata?.culpritClue ? "Clue Desk" : "Event Engine",
        subject: event.headline || "Unknown Event",
        body: event.metadata?.culpritClue ? `Clue: ${event.summary || ""}` : event.summary || "",
        priority,
        timestamp: event.happenedAt || new Date().toISOString()
      });
    });
  }

  return messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function clampPercent(value, max = 1) {
  if (!value) {
    return 0;
  }
  return Math.round(Math.min(max, Math.max(0, value)) * 100);
}

export function initials(name) {
  if (!name) {
    return "?";
  }
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getInfluenceColor(person) {
  const score = person?.dominanceScore || person?.influenceScore || person?.powerLevel || 0;
  if (score >= 800) {
    return "rgba(255,42,42,0.95)";
  }
  if (score >= 600) {
    return "rgba(255,42,42,0.72)";
  }
  if (score >= 400) {
    return "rgba(255,210,80,0.85)";
  }
  if (score >= 200) {
    return "rgba(245,245,245,0.65)";
  }
  return "rgba(245,245,245,0.35)";
}
