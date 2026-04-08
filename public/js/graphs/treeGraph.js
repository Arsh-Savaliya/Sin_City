export function renderTreeGraph({ container, root, onNodeSelect }) {
  container.innerHTML = "";
  const width = container.clientWidth || 960;
  const height = Math.max(container.clientHeight || 620, 620);

  if (typeof root._initialized !== "boolean") {
    initializeTree(root);
  }

  const hierarchy = d3.hierarchy(root, (d) => d.children);
  const treeLayout = d3.tree().size([height - 80, width - 160]);
  treeLayout(hierarchy);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "graph-svg")
    .attr("viewBox", [0, 0, width, height]);

  const wrapper = svg.append("g").attr("transform", "translate(80,40)");

  wrapper
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
    .attr("stroke", "rgba(255,255,255,0.22)")
    .attr("stroke-width", 1.5);

  const node = wrapper
    .selectAll("g")
    .data(hierarchy.descendants())
    .join("g")
    .attr("transform", (d) => `translate(${d.y},${d.x})`)
    .style("cursor", "pointer")
    .on("click", (_event, d) => {
      if (d.data.children?.length || d.data._children?.length) {
        toggleNode(d.data);
        renderTreeGraph({ container, root, onNodeSelect });
      } else if (d.data._id) {
        onNodeSelect(d.data);
      }
    });

  node
    .append("circle")
    .attr("r", (d) => (d.depth === 0 ? 14 : 10))
    .attr("fill", (d) => (d.depth === 0 ? "#d90429" : "#ffffff"))
    .attr("stroke", "#050505")
    .attr("stroke-width", 2.5);

  node
    .append("text")
    .attr("dy", -18)
    .attr("text-anchor", "middle")
    .attr("fill", "#f5f1e8")
    .attr("font-size", 12)
    .text((d) => d.data.name || d.data.title);

  node
    .append("text")
    .attr("dy", 24)
    .attr("text-anchor", "middle")
    .attr("fill", "rgba(245,241,232,0.72)")
    .attr("font-size", 11)
    .text((d) => `${d.data.rank || "Root"} | ${d.data.influenceScore || 0}`);
}

function initializeTree(node, depth = 0) {
  node._initialized = true;
  if (!node.children?.length) {
    return;
  }
  node.children.forEach((child) => initializeTree(child, depth + 1));
  if (depth > 0) {
    node._children = node.children;
    node.children = [];
  }
}

function toggleNode(node) {
  if (node.children?.length) {
    node._children = node.children;
    node.children = [];
    return;
  }

  if (node._children?.length) {
    node.children = node._children;
    node._children = [];
  }
}
