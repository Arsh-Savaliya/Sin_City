import { React, html } from "../../lib/html.js";

const d3 = window.d3;
const { useEffect, useRef } = React;

export function HierarchyGraph({ root, onSelectNode }) {
  const shellRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    const svgNode = svgRef.current;
    const tooltip = tooltipRef.current;

    if (!shell || !svgNode || !root) {
      return undefined;
    }

    const render = () => {
      const width = shell.clientWidth || 960;
      const height = Math.max(620, shell.clientHeight || 680);
      const svg = d3.select(svgNode);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      const hierarchy = d3.hierarchy(structuredClone(root), (node) => node.children);
      d3.tree().size([height - 120, width - 260])(hierarchy);

      const layer = svg.append("g").attr("transform", "translate(130,60)");

      layer
        .selectAll("path")
        .data(hierarchy.links())
        .join("path")
        .attr(
          "d",
          d3
            .linkHorizontal()
            .x((d) => d.y)
            .y((d) => d.x)
        )
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.12)")
        .attr("stroke-width", 1.4);

      const node = layer
        .selectAll("g")
        .data(hierarchy.descendants())
        .join("g")
        .attr("transform", (d) => `translate(${d.y},${d.x})`)
        .style("cursor", "pointer")
        .on("mouseenter", (event, datum) => {
          showTooltip(tooltip, shell, event, datum.data);
        })
        .on("mousemove", (event, datum) => {
          showTooltip(tooltip, shell, event, datum.data);
        })
        .on("mouseleave", () => tooltip.classList.add("hidden"))
        .on("click", (_event, datum) => onSelectNode?.(datum.data));

      node
        .append("circle")
        .attr("r", (d) => (d.depth === 0 ? 18 : 13))
        .attr("fill", (d) => (d.depth === 0 ? "#ff2a2a" : "rgba(245,245,245,0.12)"))
        .attr("stroke", "#f5f5f5")
        .attr("stroke-width", (d) => (d.depth === 0 ? 2.5 : 1.3));

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", -22)
        .attr("fill", "#f5f5f5")
        .attr("font-size", 10)
        .attr("letter-spacing", "0.18em")
        .text((d) => d.data.name);

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", 28)
        .attr("fill", "rgba(245,245,245,0.55)")
        .attr("font-size", 10)
        .text((d) => `${d.data.rank || "Member"} / ${d.data.influenceScore || 0}`);
    };

    render();
    const observer = new ResizeObserver(() => render());
    observer.observe(shell);

    return () => observer.disconnect();
  }, [onSelectNode, root]);

  return html`
    <div ref=${shellRef} className="network-shell relative h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/80">
      <svg ref=${svgRef} className="h-full w-full"></svg>
      <div ref=${tooltipRef} className="graph-tooltip hidden"></div>
    </div>
  `;
}

function showTooltip(tooltip, shell, event, node) {
  const [x, y] = d3.pointer(event, shell);
  tooltip.innerHTML = `
    <p class="eyebrow-tag">Hierarchy Detail</p>
    <h4 class="text-lg font-display uppercase tracking-[0.14em] text-white">${node.name}</h4>
    <div class="mt-3 space-y-1 text-sm text-white/75">
      <p>Rank ${node.rank || "Unknown"}</p>
      <p>Influence ${Math.round(node.influenceScore || 0)}</p>
    </div>
  `;
  tooltip.style.left = `${Math.min(x + 18, shell.clientWidth - 220)}px`;
  tooltip.style.top = `${Math.min(y + 18, shell.clientHeight - 160)}px`;
  tooltip.classList.remove("hidden");
}
