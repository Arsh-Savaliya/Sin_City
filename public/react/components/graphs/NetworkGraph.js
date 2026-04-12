import { React, html } from "../../lib/html.js";

const d3 = window.d3;
const { useEffect, useRef, useState } = React;

const linkColors = {
  alliance: "rgba(100,100,100,0.5)",
  rivalry: "rgba(255,42,42,0.8)",
  transaction: "rgba(150,150,150,0.3)",
  official: "rgba(100,150,255,0.5)",
  corruption: "rgba(255,180,50,0.8)",
  command: "rgba(255,255,255,0.4)"
};

function formatHoverStats(node) {
  if (!node) {
    return [];
  }

  if (node.role === "police") {
    return [
      { label: "Power", value: node.powerLevel || 0 },
      { label: "Influence", value: node.influenceScore || 0 },
      { label: "Cases Solved", value: node.casesSolved || 0 },
      { label: "Encounters", value: node.encounters || node.cases || 0 },
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

export function NetworkGraph({ graph, mode, selectedNode, onSelectNode }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;

    if (!container || !svgEl || !graph?.nodes?.length) {
      return undefined;
    }

    const render = () => {
      const width = container.clientWidth || 900;
      const height = container.clientHeight || 450;
      const padding = 64;
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const nodes = graph.nodes.map((node) => ({ ...node, id: node._id }));
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const links = (graph.links || [])
        .map((link) => ({
          ...link,
          source: String(link.source?._id || link.source),
          target: String(link.target?._id || link.target)
        }))
        .filter((link) => nodeById.has(link.source) && nodeById.has(link.target) && link.source !== link.target);

      const simulation = d3
        .forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((node) => node.id).distance(mode === "corruption" ? 108 : 124).strength(0.32))
        .force("charge", d3.forceManyBody().strength(mode === "corruption" ? -360 : -420))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((datum) => (datum.isBoss ? 58 : 48)))
        .force("x", d3.forceX(width / 2).strength(0.035))
        .force("y", d3.forceY(height / 2).strength(0.035));

      const defs = svg.append("defs");

      const filter = defs
        .append("filter")
        .attr("id", "glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      const gradients = [
        { id: "bossGradient", from: "#ff2a2a", to: "#4a0000" },
        { id: "policeGradient", from: "#87b7ff", to: "#123562" },
        { id: "corruptGradient", from: "#ffb432", to: "#6a2a00" },
        { id: "normalGradient", from: "#d9d9d9", to: "#555555" }
      ];

      gradients.forEach((gradient) => {
        const linear = defs.append("linearGradient").attr("id", gradient.id).attr("x1", "0%").attr("x2", "100%");
        linear.append("stop").attr("offset", "0%").attr("stop-color", gradient.from);
        linear.append("stop").attr("offset", "100%").attr("stop-color", gradient.to);
      });

      const link = svg
        .append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", (entry) => linkColors[entry.type] || "rgba(255,255,255,0.2)")
        .attr("stroke-width", (entry) => (entry.type === "command" ? 2.5 : entry.type === "rivalry" || entry.type === "corruption" ? 2 : 1))
        .attr("stroke-opacity", 0.6);

      const node = svg
        .append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .style("cursor", "pointer")
        .call(
          d3
            .drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
        )
        .on("click", (_event, datum) => onSelectNode?.(datum))
        .on("mouseenter", (event, datum) => {
          setHoveredNode({
            node: datum,
            x: event.offsetX + 18,
            y: event.offsetY + 18
          });
        })
        .on("mousemove", (event, datum) => {
          setHoveredNode({
            node: datum,
            x: event.offsetX + 18,
            y: event.offsetY + 18
          });
        })
        .on("mouseleave", () => setHoveredNode(null));

      node
        .append("circle")
        .attr("r", (datum) => (datum.isBoss ? 22 : datum.role === "police" ? 14 : 12))
        .attr("fill", (datum) => {
          if (datum.isBoss) return "url(#bossGradient)";
          if (datum.role === "police") return "url(#policeGradient)";
          if (datum.isCorrupt) return "url(#corruptGradient)";
          return "url(#normalGradient)";
        })
        .attr("stroke", (datum) => (datum._id === selectedNode?._id ? "#ff2a2a" : "rgba(255,255,255,0.3)"))
        .attr("stroke-width", (datum) => (datum._id === selectedNode?._id ? 3 : 1.5));

      node
        .filter((datum) => datum.isBoss)
        .select("circle")
        .attr("filter", "url(#glow)");

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", (datum) => (datum.isBoss ? 36 : 26))
        .attr("fill", "rgba(255,255,255,0.7)")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.1em")
        .text((datum) => datum.name?.split(" ")[0]?.slice(0, 10) || "");

      simulation.on("tick", () => {
        nodes.forEach((datum) => {
          const radius = datum.isBoss ? 26 : datum.role === "police" ? 18 : 16;
          datum.x = Math.max(padding + radius, Math.min(width - padding - radius, datum.x || width / 2));
          datum.y = Math.max(padding + radius, Math.min(height - padding - radius, datum.y || height / 2));
        });

        link
          .attr("x1", (datum) => datum.source.x)
          .attr("y1", (datum) => datum.source.y)
          .attr("x2", (datum) => datum.target.x)
          .attr("y2", (datum) => datum.target.y);

        node.attr("transform", (datum) => `translate(${datum.x},${datum.y})`);
      });

      function dragstarted(event, datum) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        datum.fx = datum.x;
        datum.fy = datum.y;
      }

      function dragged(event, datum) {
        datum.fx = event.x;
        datum.fy = event.y;
      }

      function dragended(event, datum) {
        if (!event.active) simulation.alphaTarget(0);
        datum.fx = null;
        datum.fy = null;
      }

      return () => simulation.stop();
    };

    const cleanup = render();
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [graph, mode, onSelectNode, selectedNode]);

  const hoverStats = formatHoverStats(hoveredNode?.node);

  return html`
    <div ref=${containerRef} className="relative w-full h-full min-h-[420px] flex items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,rgba(255,42,42,0.08),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.25))]">
      <svg ref=${svgRef} className="w-full h-full"></svg>

      ${hoveredNode?.node &&
      html`
        <div
          className="pointer-events-none absolute z-10 min-w-[230px] rounded-2xl border border-blood/30 bg-black/90 p-4 shadow-2xl"
          style=${{
            left: `${Math.min(hoveredNode.x, (containerRef.current?.clientWidth || 900) - 250)}px`,
            top: `${Math.min(hoveredNode.y, (containerRef.current?.clientHeight || 450) - 220)}px`
          }}
        >
          <p className="font-display text-xl uppercase tracking-[0.12em] text-blood">${hoveredNode.node.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-white/40">
            ${hoveredNode.node.rank || hoveredNode.node.role} | ${hoveredNode.node.faction || "Independent"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            ${hoverStats.map((item) => html`
              <div key=${item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/35">${item.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">${item.value}</p>
              </div>
            `)}
          </div>
        </div>
      `}
    </div>
  `;
}
