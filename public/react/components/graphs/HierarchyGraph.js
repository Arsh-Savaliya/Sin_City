import { React, html } from "../../lib/html.js";

const d3 = window.d3;
const { useEffect, useRef } = React;

export function HierarchyGraph({ root, onSelectNode }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;

    if (!container || !svgEl || !root) return;

    const render = () => {
      const width = container.clientWidth || 900;
      const height = container.clientHeight || 500;
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      // Prepare hierarchical data
      const data = structuredClone(root);
      
      // Create tree layout with proper spacing
      const rootNode = d3.hierarchy(data, d => d.children);
      const treeLayout = d3.tree()
        .size([width - 120, height - 120])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.8));
      
      const treeData = treeLayout(rootNode);
      const nodes = treeData.descendants();
      const links = treeData.links();

      // Create main group with padding
      const g = svg.append("g")
        .attr("transform", `translate(60,60)`);

      // Draw curved links (bezier curves)
      g.selectAll("path.link")
        .data(links)
        .join("path")
        .attr("class", "link")
        .attr("d", d => {
          const sourceX = d.source.x;
          const sourceY = d.source.y + 30;
          const targetX = d.target.x;
          const targetY = d.target.y + 30;
          return `M${sourceX},${sourceY}C${sourceX},${(sourceY + targetY) / 2} ${targetX},${(sourceY + targetY) / 2} ${targetX},${targetY}`;
        })
        .attr("fill", "none")
        .attr("stroke", "rgba(255,42,42,0.25)")
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");

      // Draw nodes
      const nodeGroups = g.selectAll("g.node")
        .data(nodes)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y + 30})`)
        .style("cursor", "pointer")
        .on("click", (e, d) => {
          onSelectNode?.(d.data);
        })
        .on("mouseenter", function(e, d) {
          d3.select(this).select("circle")
            .transition()
            .duration(200)
            .attr("r", d.children ? 24 : 16);
        })
        .on("mouseleave", function(e, d) {
          d3.select(this).select("circle")
            .transition()
            .duration(200)
            .attr("r", d.children ? 20 : 12);
        });

      // Outer glow for bosses
      nodeGroups.filter(d => d.data.isBoss || d.depth === 0)
        .append("circle")
        .attr("r", 26)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,42,42,0.3)")
        .attr("stroke-width", 1);

      // Node circles - gradient effect for bosses
      nodeGroups.append("circle")
        .attr("r", d => d.children ? 20 : 12)
        .attr("fill", d => {
          if (d.data.isBoss || d.depth === 0) return "#1a1a1a";
          return "rgba(20,20,20,0.9)";
        })
        .attr("stroke", d => d.data.isBoss || d.depth === 0 ? "#ff2a2a" : "rgba(255,255,255,0.4)")
        .attr("stroke-width", d => d.data.isBoss || d.depth === 0 ? 2.5 : 1.2);

      // Name labels (first name only for cleanliness)
      nodeGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d => d.children ? -28 : -18)
        .attr("fill", "#ffffff")
        .attr("font-size", "10px")
        .attr("font-weight", d => d.data.isBoss || d.depth === 0 ? "700" : "500")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "0.15em")
        .text(d => {
          const name = d.data.name || "";
          return name.split(" ")[0].slice(0, 8);
        });

      // Rank labels
      nodeGroups.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", d => d.children ? -14 : 22)
        .attr("fill", d => d.data.isBoss || d.depth === 0 ? "#ff2a2a" : "rgba(255,255,255,0.45)")
        .attr("font-size", "8px")
        .attr("text-transform", "uppercase")
        .attr("letter-spacing", "0.1em")
        .text(d => d.data.rank || "");
    };

    render();
    const observer = new ResizeObserver(() => render());
    observer.observe(container);
    return () => observer.disconnect();
  }, [root, onSelectNode]);

  return html`
    <div ref=${containerRef} className="w-full h-full flex items-center justify-center">
      <svg ref=${svgRef} className="w-full h-full"></svg>
    </div>
  `;
}