export function renderHeatmap(container, pressure = {}) {
  container.innerHTML = "";

  const entries = Object.entries(pressure);
  if (!entries.length) {
    container.innerHTML = "<p class='text-sm text-zinc-400'>No district data yet.</p>";
    return;
  }

  const width = container.clientWidth || 420;
  const height = 220;
  const margin = { top: 18, right: 16, bottom: 44, left: 100 };

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "graph-svg")
    .attr("viewBox", [0, 0, width, height]);

  const x = d3
    .scaleLinear()
    .domain([0, d3.max(entries, (d) => d[1])])
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleBand()
    .domain(entries.map((d) => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.16);

  const color = d3
    .scaleLinear()
    .domain([0, d3.max(entries, (d) => d[1])])
    .range(["rgba(255,255,255,0.12)", "#d90429"]);

  svg
    .append("g")
    .selectAll("rect")
    .data(entries)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d) => y(d[0]))
    .attr("width", (d) => x(d[1]) - margin.left)
    .attr("height", y.bandwidth())
    .attr("rx", 10)
    .attr("fill", (d) => color(d[1]));

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(4).tickSizeOuter(0))
    .call((g) => g.selectAll("text").attr("fill", "rgba(245,241,232,0.72)"))
    .call((g) => g.selectAll("line,path").attr("stroke", "rgba(255,255,255,0.12)"));

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call((g) => g.selectAll("text").attr("fill", "rgba(245,241,232,0.78)"))
    .call((g) => g.select("path").remove());
}
