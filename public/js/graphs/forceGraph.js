const edgeColors = {
  alliance: "#ffffff",
  rivalry: "#d90429",
  transaction: "#ff8c42",
  command: "#ffffff",
  official: "#7dd3fc",
  corruption: "#facc15"
};

function linkKey(link) {
  const sourceId = typeof link.source === "object" ? link.source._id || link.source.id : link.source;
  const targetId = typeof link.target === "object" ? link.target._id || link.target.id : link.target;
  return `${sourceId}:${targetId}`;
}

export function renderForceGraph({
  container,
  tooltip,
  graph,
  onNodeSelect,
  filters,
  timelineCutoff
}) {
  const width = container.clientWidth || 960;
  const height = Math.max(container.clientHeight || 620, 620);
  container.innerHTML = "";

  const nodes = graph.nodes
    .filter((node) => applyNodeFilter(node, filters))
    .map((node) => ({ ...node, id: node._id }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = graph.links
    .filter((link) => {
      const sourceId = link.source?._id || link.source;
      const targetId = link.target?._id || link.target;
      const startedAt = new Date(link.startedAt || Date.now()).getTime();
      return nodeIds.has(sourceId.toString()) && nodeIds.has(targetId.toString()) && startedAt <= timelineCutoff;
    })
    .map((link) => ({
      ...link,
      source: link.source?._id || link.source,
      target: link.target?._id || link.target
    }));

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "graph-svg")
    .attr("viewBox", [0, 0, width, height]);

  const defs = svg.append("defs");
  const glow = defs.append("filter").attr("id", "glow-filter");
  glow.append("feGaussianBlur").attr("stdDeviation", "3.5").attr("result", "coloredBlur");
  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in", "coloredBlur");
  merge.append("feMergeNode").attr("in", "SourceGraphic");

  const adjacency = new Map();
  links.forEach((link) => {
    adjacency.set(`${link.source}:${link.target}`, true);
    adjacency.set(`${link.target}:${link.source}`, true);
  });

  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => 95 + (4 - d.weight) * 18))
    .force("charge", d3.forceManyBody().strength(-370))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius((d) => nodeRadius(d) + 18));

  const linkLayer = svg.append("g");
  const nodeLayer = svg.append("g");

  const link = linkLayer
    .selectAll("line")
    .data(links, linkKey)
    .join("line")
    .attr("stroke", (d) => edgeColors[d.type] || "#ffffff")
    .attr("stroke-width", (d) => Math.max(1.2, d.weight * 1.5))
    .attr("stroke-opacity", (d) => edgeOpacity(d))
    .attr("stroke-dasharray", (d) => (d.type === "rivalry" ? "10 8" : null))
    .style("animation", (d) => (d.type === "rivalry" || d.tensionScore >= 75 ? "pulseGlow 0.9s ease-in-out infinite" : "none"))
    .attr("filter", "url(#glow-filter)");

  const node = nodeLayer
    .selectAll("g")
    .data(nodes, (d) => d.id)
    .join("g")
    .style("cursor", "pointer")
    .call(drag(simulation));

  node
    .append("circle")
    .attr("class", (d) => (d.dominanceScore >= 400 ? "node-core" : ""))
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", (d) => nodeFill(d))
    .attr("stroke", (d) => (d.isBoss ? "#f5f1e8" : d.status === "dead" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.92)"))
    .attr("stroke-width", (d) => (d.isBoss ? 3.2 : d.isCorrupt ? 2.8 : 1.6))
    .attr("opacity", (d) => nodeOpacity(d))
    .attr("filter", "url(#glow-filter)");

  node
    .filter((d) => d.status === "dead")
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dy", 5)
    .attr("fill", "#f5f1e8")
    .attr("font-size", 18)
    .text("X");

  node
    .filter((d) => d.isBoss)
    .append("circle")
    .attr("r", (d) => nodeRadius(d) + 6)
    .attr("fill", "none")
    .attr("stroke", "rgba(245,241,232,0.35)")
    .attr("stroke-width", 1.5);

  node
    .append("text")
    .attr("class", "node-label")
    .attr("text-anchor", "middle")
    .attr("dy", (d) => nodeRadius(d) + 18)
    .text((d) => d.name);

  node
    .on("mouseenter", (event, datum) => {
      highlightLinked(node, link, datum, adjacency);
      showTooltip(event, datum, tooltip);
    })
    .on("mousemove", (event, datum) => showTooltip(event, datum, tooltip))
    .on("mouseleave", () => {
      resetHighlight(node, link);
      tooltip.classList.add("hidden");
    })
    .on("click", (_event, datum) => onNodeSelect(datum));

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

function applyNodeFilter(node, filters) {
  const query = filters.search.trim().toLowerCase();
  const haystack = [
    node.name,
    node.alias,
    node.rank,
    node.faction,
    node.backgroundTier,
    node.backgroundSummary,
    node.backstory,
    ...(node.crimesCommitted || []),
    ...(node.weaknessTags || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const queryPass = !query || haystack.includes(query);
  const rolePass =
    filters.role === "all" ||
    node.role === filters.role ||
    (filters.role === "corrupt" && node.isCorrupt) ||
    (filters.role === "dead" && node.status === "dead");

  return queryPass && rolePass;
}

function nodeRadius(node) {
  return 8 + Math.min((node.dominanceScore || 120) / 32, 30);
}

function nodeFill(node) {
  if (node.status === "dead") {
    return "rgba(140, 140, 140, 0.6)";
  }
  if (node.role === "police") {
    return node.isCorrupt ? "#facc15" : "#7dd3fc";
  }
  if (node.isOutsider) {
    return "#ff8c42";
  }
  return "#d90429";
}

function nodeOpacity(node) {
  if (node.status === "dead") {
    return 0.28;
  }
  if ((node.dominanceScore || 0) < 180) {
    return 0.42;
  }
  return 1;
}

function edgeOpacity(link) {
  if (link.status === "severed") {
    return 0.12;
  }
  if (link.status === "weakening") {
    return 0.26;
  }
  return 0.35 + Math.min((link.tensionScore || 0) / 200, 0.45);
}

function showTooltip(event, datum, tooltip) {
  const policeLines =
    datum.role === "police"
      ? `<p>Cases solved: ${datum.casesSolved || 0}</p><p>Integrity: ${datum.integrityScore || 0}</p>`
      : "";
  tooltip.innerHTML = `
    <div class="space-y-1">
      <p class="eyebrow">${datum.role} dossier</p>
      <h4 class="text-lg font-semibold">${datum.name}</h4>
      <p>Dominance: ${Math.round(datum.dominanceScore || 0)}</p>
      <p>Power: ${datum.powerLevel || 0}</p>
      <p>Loyalty: ${datum.loyaltyScore || 0}</p>
      <p>Ambition: ${datum.ambitionLevel || 0}</p>
      <p>Fear: ${datum.fearFactor || 0}</p>
      <p>Intelligence: ${datum.intelligenceLevel || 0}</p>
      <p>Background: ${datum.backgroundTier || "unknown"}</p>
      <p>Weakness: ${(datum.weaknessTags || []).join(", ") || "None"}</p>
      ${policeLines}
      <p>Status: ${datum.status}</p>
    </div>
  `;

  tooltip.style.left = `${event.offsetX + 18}px`;
  tooltip.style.top = `${event.offsetY + 24}px`;
  tooltip.classList.remove("hidden");
}

function highlightLinked(nodes, links, hovered, adjacency) {
  nodes.selectAll("circle").attr("opacity", (d) => (isNeighbor(hovered, d, adjacency) ? nodeOpacity(d) : 0.12));
  nodes.selectAll("text").attr("opacity", (d) => (isNeighbor(hovered, d, adjacency) ? 1 : 0.2));
  links.attr("stroke-opacity", (d) =>
    d.source.id === hovered.id || d.target.id === hovered.id ? 1 : 0.05
  );
}

function resetHighlight(nodes, links) {
  nodes.selectAll("circle").attr("opacity", (d) => nodeOpacity(d));
  nodes.selectAll("text").attr("opacity", 1);
  links.attr("stroke-opacity", (d) => edgeOpacity(d));
}

function isNeighbor(a, b, adjacency) {
  return a.id === b.id || adjacency.has(`${a.id}:${b.id}`);
}

function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragended(event) {
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    event.subject.fx = null;
    event.subject.fy = null;
  }

  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}
