import { React, html } from "../../lib/html.js";

const d3 = window.d3;
const { useEffect, useRef } = React;

export function PressureHeatmap({ pressure = {} }) {
  const shellRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    const svgNode = svgRef.current;

    if (!shell || !svgNode) {
      return undefined;
    }

    const entries = Object.entries(pressure || {});
    const render = () => {
      const width = shell.clientWidth || 820;
      const height = Math.max(300, shell.clientHeight || 340);
      const svg = d3.select(svgNode);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`);

      if (!entries.length) {
        svg
          .append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "rgba(245,245,245,0.45)")
          .text("No pressure data available");
        return;
      }

      const margin = { top: 20, right: 40, bottom: 44, left: 120 };
      const maxValue = d3.max(entries, (entry) => entry[1]) || 1;

      const x = d3.scaleLinear().domain([0, maxValue]).range([margin.left, width - margin.right]);
      const y = d3
        .scaleBand()
        .domain(entries.map((entry) => entry[0]))
        .range([margin.top, height - margin.bottom])
        .padding(0.16);

      const color = d3
        .scaleLinear()
        .domain([0, maxValue])
        .range(["rgba(255,255,255,0.1)", "rgba(255,42,42,0.92)"]);

      svg
        .append("g")
        .selectAll("rect")
        .data(entries)
        .join("rect")
        .attr("x", margin.left)
        .attr("y", (entry) => y(entry[0]))
        .attr("width", (entry) => x(entry[1]) - margin.left)
        .attr("height", y.bandwidth())
        .attr("rx", 16)
        .attr("fill", (entry) => color(entry[1]))
        .attr("class", "pressure-bar");

      svg
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
        .call((group) => group.selectAll("text").attr("fill", "rgba(245,245,245,0.55)"))
        .call((group) => group.selectAll("line,path").attr("stroke", "rgba(255,255,255,0.12)"));

      svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .call((group) => group.selectAll("text").attr("fill", "rgba(245,245,245,0.82)"))
        .call((group) => group.select("path").remove());
    };

    render();
    const observer = new ResizeObserver(() => render());
    observer.observe(shell);

    return () => observer.disconnect();
  }, [pressure]);

  return html`
    <div ref=${shellRef} className="relative h-[340px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/80">
      <svg ref=${svgRef} className="h-full w-full"></svg>
    </div>
  `;
}
