import { React, html } from "../../lib/html.js";

const d3 = window.d3;
const { useEffect, useRef } = React;

const linkColors = {
  alliance: "rgba(100,100,100,0.5)",
  rivalry: "rgba(255,42,42,0.8)",
  transaction: "rgba(150,150,150,0.3)",
  official: "rgba(100,150,255,0.5)",
  corruption: "rgba(255,180,50,0.8)",
  command: "rgba(255,255,255,0.4)"
};

export function NetworkGraph({ graph, mode, selectedNode, onSelectNode }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;

    if (!container || !svgEl || !graph?.nodes?.length) return;

    const render = () => {
      const width = container.clientWidth || 900;
      const height = container.clientHeight || 450;
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      // Prepare nodes with proper IDs
      const nodes = graph.nodes.map(n => ({ ...n, id: n._id }));
      const nodeById = new Map(nodes.map(n => [n.id, n]));
      
      // Filter valid links
      const links = (graph.links || [])
        .map(l => ({
          ...l,
          source: String(l.source?._id || l.source),
          target: String(l.target?._id || l.target)
        }))
        .filter(l => nodeById.has(l.source) && nodeById.has(l.target) && l.source !== l.target);

      if (!nodes.length) return;

      // Create simulation
      const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(80).strength(0.5))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(35));

      // Create gradient definitions
      const defs = svg.append("defs");
      
      // Glow filter
      const filter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      // Draw links
      const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => linkColors[d.type] || "rgba(255,255,255,0.2)")
        .attr("stroke-width", d => d.type === "command" ? 2.5 : d.type === "rivalry" || d.type === "corruption" ? 2 : 1)
        .attr("stroke-opacity", 0.6);

      // Draw nodes
      const node = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .style("cursor", "pointer")
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
        .on("click", (e, d) => onSelectNode?.(d));

      // Node circles with gradient fill
      node.append("circle")
        .attr("r", d => d.isBoss ? 22 : d.role === "police" ? 14 : 12)
        .attr("fill", d => {
          if (d.isBoss) return "url(#bossGradient)";
          if (d.role === "police") return "url(#policeGradient)";
          if (d.isCorrupt) return "url(#corruptGradient)";
          return "url(#normalGradient)";
        })
        .attr("stroke", d => d._id === selectedNode?._id ? "#ff2a2a" : "rgba(255,255,255,0.3)")
        .attr("stroke-width", d => d._id === selectedNode?._id ? 3 : 1.5);

      // Add glow to bosses
      node.filter(d => d.isBoss)
        .select("circle")
        .attr("filter", "url(#glow)");

      // Node labels
      node.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d => d.isBoss ? 36 : 26)
        .attr("fill", "rgba(255,255,255,0.7)")
        .attr("font-size", "9px")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "0.1em")
        .text(d => d.name?.split(" ")[0]?.slice(0,6) || "");

      // Run simulation
      simulation.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      // Cleanup
      return () => simulation.stop();
    };

    render();
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [graph, selectedNode, onSelectNode]);

  return html`
    <div ref=${containerRef} className="w-full h-full flex items-center justify-center">
      <svg ref=${svgRef} className="w-full h-full"></svg>
    </div>
  `;
}