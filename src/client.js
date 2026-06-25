(function () {
  const { data, layout } = window.MIND_MAP_DATA;
  const svg = document.querySelector("#graph");
  const details = document.querySelector("#details");
  const search = document.querySelector("#search");
  const clusterFilter = document.querySelector("#clusterFilter");
  const linkFilter = document.querySelector("#linkFilter");
  const reset = document.querySelector("#reset");
  const clusters = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));
  const nodes = data.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let selectedId = "person:frank";

  svg.setAttribute("viewBox", layout.viewBox.join(" "));

  for (const cluster of data.clusters) {
    const option = document.createElement("option");
    option.value = cluster.id;
    option.textContent = cluster.label;
    clusterFilter.appendChild(option);
  }

  function matchesNode(node) {
    const query = search.value.trim().toLowerCase();
    const cluster = clusterFilter.value;
    const content = [
      node.publicLabel,
      node.type,
      node.summary,
      node.privacyLevel,
      clusters.get(node.cluster)?.label,
      ...node.evidence.flatMap((item) => [item.source, item.lines, item.note])
    ].join(" ").toLowerCase();
    return (cluster === "all" || node.cluster === cluster) && (!query || content.includes(query));
  }

  function visibleNodeIds() {
    return new Set(nodes.filter(matchesNode).map((node) => node.id));
  }

  function edgeIsVisible(edge) {
    return linkFilter.value === "all" || edge.primary;
  }

  function connectedToSelected(edge) {
    return edge.source === selectedId || edge.target === selectedId;
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }

  function textLines(group, lines, x, y, className, gap = 17) {
    const start = y - ((lines.length - 1) * gap) / 2;
    lines.forEach((line, index) => {
      const text = svgEl("text", { x, y: start + index * gap, class: className });
      text.textContent = line;
      group.appendChild(text);
    });
  }

  function draw() {
    svg.innerHTML = "";
    const shown = visibleNodeIds();
    const hasMatches = shown.size > 0;
    if (hasMatches && !shown.has(selectedId)) selectedId = shown.values().next().value;

    const territoryLayer = svgEl("g");
    for (const territory of layout.territories) {
      const rect = svgEl("rect", {
        x: territory.x,
        y: territory.y,
        width: territory.width,
        height: territory.height,
        rx: 34,
        class: "territory",
        fill: territory.color,
        stroke: territory.color
      });
      territoryLayer.appendChild(rect);
      const label = svgEl("text", {
        x: territory.x + 26,
        y: territory.y + 34,
        class: "territory-label"
      });
      label.textContent = territory.label;
      territoryLayer.appendChild(label);
    }
    svg.appendChild(territoryLayer);

    const edgeLayer = svgEl("g");
    for (const edge of data.edges) {
      if (!edgeIsVisible(edge)) continue;
      const source = layout.nodes[edge.source];
      const target = layout.nodes[edge.target];
      if (!source || !target) continue;
      const connected = hasMatches && connectedToSelected(edge);
      const risk = nodeById.get(edge.source)?.risk || nodeById.get(edge.target)?.risk;
      const line = svgEl("path", {
        d: curvedPath(source, target),
        class: ["edge", edge.primary ? "primary" : "", connected ? "connected" : "", risk ? "risk" : ""].join(" ")
      });
      edgeLayer.appendChild(line);
    }
    svg.appendChild(edgeLayer);

    const nodeLayer = svgEl("g");
    for (const node of nodes) {
      const point = layout.nodes[node.id];
      const cluster = clusters.get(node.cluster);
      const selected = hasMatches && node.id === selectedId;
      const visible = shown.has(node.id);
      const group = svgEl("g", {
        class: ["node", node.id === "person:frank" ? "center" : "", selected ? "selected" : "", visible ? "" : "faded"].join(" "),
        tabindex: 0,
        role: "button",
        "aria-label": node.publicLabel
      });
      group.addEventListener("click", () => selectNode(node.id));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(node.id);
        }
      });
      group.appendChild(svgEl("circle", { cx: point.x, cy: point.y, r: point.radius + 12, class: "selection-ring" }));
      group.appendChild(svgEl("rect", {
        x: point.x - point.radius,
        y: point.y - point.radius * 0.58,
        width: point.radius * 2,
        height: point.radius * 1.16,
        rx: 18,
        class: "node-card",
        stroke: node.risk ? "#dc2626" : cluster.color
      }));
      group.appendChild(svgEl("circle", {
        cx: point.x - point.radius + 18,
        cy: point.y,
        r: 4,
        class: "dot",
        fill: node.risk ? "#dc2626" : cluster.color
      }));
      textLines(group, node.displayLabel, point.x, point.y - 5, "node-label", node.id === "person:frank" ? 24 : 16);
      if (node.id === "person:frank") textLines(group, ["Information Designer", "Systems Builder"], point.x, point.y + 43, "node-sub", 15);
      nodeLayer.appendChild(group);
    }
    svg.appendChild(nodeLayer);
    renderDetails(hasMatches ? nodeById.get(selectedId) : null);
  }

  function curvedPath(a, b) {
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
  }

  function selectNode(id) {
    selectedId = id;
    draw();
  }

  function renderDetails(node) {
    if (!node) {
      details.innerHTML = `
        <div class="inspector-kicker">No matching topics</div>
        <h2>No results</h2>
        <p>Adjust the search text or cluster filter to bring topics back into view.</p>
        <div class="chip-row">
          <span class="chip">0 visible topics</span>
        </div>
      `;
      return;
    }
    const cluster = clusters.get(node.cluster);
    const related = data.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => {
        const other = nodeById.get(edge.source === node.id ? edge.target : edge.source);
        return { label: other?.publicLabel || "Unknown", relation: edge.label };
      });

    details.innerHTML = `
      <div class="inspector-kicker">Selected topic</div>
      <h2>${escapeHtml(node.publicLabel)}</h2>
      <p>${escapeHtml(node.summary)}</p>
      <div class="chip-row">
        <span class="chip">${escapeHtml(cluster.label)}</span>
        <span class="chip">confidence: ${escapeHtml(node.confidence)}</span>
        <span class="chip">privacy: ${escapeHtml(node.privacyLevel)}</span>
      </div>
      <h3>Connected Topics</h3>
      <ul class="connected-list">${related.map((item) => `<li><strong>${escapeHtml(item.label)}</strong><br>${escapeHtml(item.relation)}</li>`).join("") || "<li>No visible links.</li>"}</ul>
      <h3>Evidence</h3>
      <ul class="evidence-list">${node.evidence.map((item) => `<li><strong>${escapeHtml(item.source)}:${escapeHtml(item.lines)}</strong><br>${escapeHtml(item.note)}</li>`).join("")}</ul>
    `;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  search.addEventListener("input", draw);
  clusterFilter.addEventListener("change", draw);
  linkFilter.addEventListener("change", draw);
  reset.addEventListener("click", () => {
    search.value = "";
    clusterFilter.value = "all";
    linkFilter.value = "primary";
    selectedId = "person:frank";
    draw();
  });

  draw();
})();
