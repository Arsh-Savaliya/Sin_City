import { React, html } from "../../lib/html.js";
import { getInfluenceColor, initials } from "../../utils/dashboard.js";

const d3 = window.d3;
const { useEffect, useRef } = React;

const linkColors = {
  alliance: "rgba(245,245,245,0.6)",
  rivalry: "rgba(255,42,42,0.92)",
  transaction: "rgba(245,245,245,0.25)",
  official: "rgba(245,245,245,0.42)",
  corruption: "rgba(255,210,80,0.9)",
  command: "rgba(255,255,255,0.32)"
};

export function NetworkGraph({
  graph,
  mode,
  hiddenRelations = [],
  onSelectNode,
  selectedNode,
  revealHiddenRelations
}) {
  const shellRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    const svgNode = svgRef.current;
    const tooltip = tooltipRef.current;

    if (!shell || !svgNode) {
      return undefined;
    }

    const render = () => {
      const width = shell.clientWidth || 960;
      const height = Math.max(620, Math.round(shell.clientHeight || 680));
      const svg = d3.select(svgNode);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const nodeSource = (graph?.nodes || []).map((node) => ({
        ...node,
        id: node._id
      }));
      const nodeIds = new Set(nodeSource.map((node) => String(node.id)));
      const linkSource = (graph?.links || [])
        .filter((link) => {
          const sourceId = String(link.source?._id || link.source);
          const targetId = String(link.target?._id || link.target);
          return nodeIds.has(sourceId) && nodeIds.has(targetId) && sourceId !== targetId;
        })
        .map((link) => ({
          ...link,
          source: String(link.source?._id || link.source),
          target: String(link.target?._id || link.target)
        }));

      if (!nodeSource.length) {
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "rgba(245,245,245,0.5)")
          .attr("class", "font-display text-[18px] tracking-[0.18em]")
          .text("NO NETWORK DATA");
        return;
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const ranked = [...nodeSource].sort(
        (left, right) => (right.dominanceScore || 0) - (left.dominanceScore || 0)
      );
      const rings = [0, 110, 180, 250, 315];

      ranked.forEach((node, index) => {
        const ringIndex = index === 0 ? 0 : Math.min(rings.length - 1, Math.floor(index / 4) + 1);
        const angle = index === 0 ? 0 : ((index - 1) / Math.max(ranked.length - 1, 1)) * Math.PI * 2;
        node.x = centerX + Math.cos(angle) * rings[ringIndex];
        node.y = centerY + Math.sin(angle) * rings[ringIndex];
      });

      const simulation = d3
        .forceSimulation(ranked)
        .force("link", d3.forceLink(linkSource).id((d) => d.id).distance((d) => 120 - Math.min((d.weight || 1) * 12, 54)))
        .force("charge", d3.forceManyBody().strength(-160))
        .force("collision", d3.forceCollide().radius((d) => nodeRadius(d) + 24))
        .force("center", d3.forceCenter(centerX, centerY))
        .force(
          "ring",
          d3
            .forceRadial((d, index) => (index === 0 ? 0 : rings[Math.min(rings.length - 1, Math.floor(index / 4) + 1)]), centerX, centerY)
            .strength(0.12)
        )
        .stop();

      for (let tick = 0; tick < 240; tick += 1) {
        simulation.tick();
      }

      ranked.forEach((node) => {
        node.fx = node.x;
        node.fy = node.y;
      });

      const adjacency = new Map();
      linkSource.forEach((link) => {
        adjacency.set(`${link.source}:${link.target}`, true);
        adjacency.set(`${link.target}:${link.source}`, true);
      });

      const defs = svg.append("defs");
      const glow = defs.append("filter").attr("id", `glow-${mode}`);
      glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
      const merge = glow.append("feMerge");
      merge.append("feMergeNode").attr("in", "blur");
      merge.append("feMergeNode").attr("in", "SourceGraphic");

      drawSpiderweb(svg, width, height, centerX, centerY);

      const gridLayer = svg.append("g").attr("class", "network-grid");
      const linkLayer = svg.append("g").attr("class", "network-links");
      const hiddenLayer = svg.append("g").attr("class", "network-hidden-links");
      const nodeLayer = svg.append("g").attr("class", "network-nodes");

      gridLayer
        .append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", 82)
        .attr("fill", "rgba(255,42,42,0.06)")
        .attr("stroke", "rgba(255,42,42,0.16)")
        .attr("filter", `url(#glow-${mode})`);

      const links = linkLayer
        .selectAll("line")
        .data(linkSource)
        .join("line")
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)
        .attr("stroke", (d) => linkColors[d.type] || "rgba(245,245,245,0.22)")
        .attr("stroke-width", (d) => 1.2 + (d.weight || 1) * 0.7)
        .attr("stroke-opacity", (d) => (d.tensionScore >= 75 ? 0.95 : 0.34))
        .attr("stroke-dasharray", (d) => (d.type === "rivalry" ? "8 8" : null))
        .attr("class", (d) => (d.type === "rivalry" || d.tensionScore >= 75 ? "edge-rivalry" : ""));

      if (revealHiddenRelations) {
        const hiddenLinks = hiddenRelations
          .filter(
            (relation) =>
              nodeIds.has(String(relation.sourceId)) && nodeIds.has(String(relation.targetId))
          )
          .map((relation) => ({
            ...relation,
            source: ranked.find((node) => node.id === relation.sourceId),
            target: ranked.find((node) => node.id === relation.targetId)
          }))
          .filter((relation) => relation.source && relation.target);

        hiddenLayer
          .selectAll("line")
          .data(hiddenLinks)
          .join("line")
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y)
          .attr("stroke", "rgba(255, 190, 85, 0.92)")
          .attr("stroke-width", 1.7)
          .attr("stroke-dasharray", "3 10")
          .attr("class", "hidden-relation-line");
      }

      const nodes = nodeLayer
        .selectAll("g")
        .data(ranked)
        .join("g")
        .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
        .style("cursor", "pointer");

      nodes
        .append("circle")
        .attr("r", (d) => nodeRadius(d) + (d.isBoss ? 5 : 0))
        .attr("fill", "rgba(0,0,0,0.85)")
        .attr("stroke", (d) => getInfluenceColor(d))
        .attr("stroke-width", (d) => (d.isBoss ? 3 : 1.6))
        .attr("filter", `url(#glow-${mode})`)
        .attr("class", (d) => (d.dominanceScore >= 430 ? "node-pulse" : ""));

      nodes
        .append("circle")
        .attr("r", (d) => nodeRadius(d))
        .attr("fill", (d) => getInfluenceColor(d))
        .attr("fill-opacity", (d) => ((d.dominanceScore || 0) < 220 ? 0.24 : 0.14))
        .attr("stroke", "rgba(255,255,255,0.12)");

      nodes
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", 4)
        .attr("fill", "#f5f5f5")
        .attr("font-size", (d) => (nodeRadius(d) > 28 ? 12 : 10))
        .attr("font-weight", 700)
        .text((d) => initials(d.name));

      nodes
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", (d) => nodeRadius(d) + 18)
        .attr("fill", "rgba(245,245,245,0.88)")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.18em")
        .attr("text-transform", "uppercase")
        .text((d) => truncateLabel(d.name, 16));

      let focusId = selectedNode?._id || null;
      updateHighlight(focusId);

      nodes
        .on("mouseenter", function onMouseEnter(event, datum) {
          updateHighlight(datum.id, true);
          showTooltip(tooltip, shell, event, datum);
        })
        .on("mousemove", function onMouseMove(event, datum) {
          showTooltip(tooltip, shell, event, datum);
        })
        .on("mouseleave", function onMouseLeave() {
          hideTooltip(tooltip);
          updateHighlight(focusId);
        })
        .on("click", function onClick(_event, datum) {
          focusId = datum.id;
          updateHighlight(focusId);
          onSelectNode?.(datum);
        });

      function updateHighlight(activeId, hoverOnly = false) {
        if (!activeId) {
          nodes.attr("opacity", (node) => baseOpacity(node));
          links.attr("stroke-opacity", (edge) => edgeOpacity(edge));
          hiddenLayer.selectAll("line").attr("stroke-opacity", 0.66);
          return;
        }

        nodes.attr("opacity", (node) =>
          node.id === activeId || adjacency.has(`${activeId}:${node.id}`) ? 1 : hoverOnly ? 0.18 : 0.26
        );

        links.attr("stroke-opacity", (edge) =>
          edge.source.id === activeId || edge.target.id === activeId ? 1 : hoverOnly ? 0.07 : 0.14
        );

        hiddenLayer
          .selectAll("line")
          .attr("stroke-opacity", (edge) =>
            edge.source.id === activeId || edge.target.id === activeId ? 1 : 0.16
          );
      }
    };

    render();
    const observer = new ResizeObserver(() => render());
    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, [graph, hiddenRelations, mode, onSelectNode, revealHiddenRelations, selectedNode]);

  return html`
    <div ref=${shellRef} className="network-shell relative h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/80">
      <svg ref=${svgRef} className="h-full w-full"></svg>
      <div ref=${tooltipRef} className="graph-tooltip hidden"></div>
    </div>
  `;
}

function drawSpiderweb(svg, width, height, centerX, centerY) {
  const rings = [90, 160, 235, 310];
  const web = svg.append("g").attr("class", "pointer-events-none");

  rings.forEach((radius) => {
    web
      .append("circle")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.045)")
      .attr("stroke-width", 1);
  });

  const radialCount = 12;
  for (let index = 0; index < radialCount; index += 1) {
    const angle = (index / radialCount) * Math.PI * 2;
    web
      .append("line")
      .attr("x1", centerX)
      .attr("y1", centerY)
      .attr("x2", centerX + Math.cos(angle) * Math.min(width, height) * 0.46)
      .attr("y2", centerY + Math.sin(angle) * Math.min(width, height) * 0.46)
      .attr("stroke", "rgba(255,255,255,0.035)")
      .attr("stroke-width", 1);
  }
}

function showTooltip(tooltip, shell, event, node) {
  if (!tooltip || !shell) {
    return;
  }

  const [x, y] = d3.pointer(event, shell);
  tooltip.innerHTML = `
    <p class="eyebrow-tag">Node Detail</p>
    <h4 class="text-lg font-display uppercase tracking-[0.14em] text-white">${node.name}</h4>
    <p class="mt-2 text-xs uppercase tracking-[0.16em] text-white/50">${node.rank || node.role}</p>
    <div class="mt-3 space-y-1 text-sm text-white/75">
      <p>Influence ${Math.round(node.influenceScore || node.dominanceScore || 0)}</p>
      <p>Dominance ${Math.round(node.dominanceScore || 0)}</p>
      <p>Power ${node.powerLevel || 0}</p>
      <p>Status ${node.status || "alive"}</p>
    </div>
  `;
  tooltip.style.left = `${Math.min(x + 18, shell.clientWidth - 220)}px`;
  tooltip.style.top = `${Math.min(y + 18, shell.clientHeight - 170)}px`;
  tooltip.classList.remove("hidden");
}

function hideTooltip(tooltip) {
  tooltip?.classList.add("hidden");
}

function nodeRadius(node) {
  return 18 + Math.min((node.dominanceScore || 150) / 38, 22);
}

function baseOpacity(node) {
  if (node.status === "dead") {
    return 0.28;
  }
  if ((node.dominanceScore || 0) < 220) {
    return 0.52;
  }
  return 1;
}

function edgeOpacity(edge) {
  if (edge.status === "severed") {
    return 0.08;
  }
  return edge.tensionScore >= 75 ? 0.95 : 0.34;
}

function truncateLabel(label, max = 18) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
