import fs from "node:fs";
import path from "node:path";

const data = JSON.parse(fs.readFileSync("data/mind-map-snapshot.json", "utf8"));
const layout = JSON.parse(fs.readFileSync("src/layout.json", "utf8"));
const styles = fs.readFileSync("src/styles.css", "utf8");
const client = fs.readFileSync("src/client.js", "utf8");
const GA_MEASUREMENT_ID = "G-RSVR6Y389R";

fs.mkdirSync("site", { recursive: true });
fs.mkdirSync("exports", { recursive: true });

fs.writeFileSync("site/styles.css", styles);
fs.writeFileSync("site/app.js", client);
fs.writeFileSync("site/index.html", renderHtml());
fs.writeFileSync("exports/mind-map-snapshot.svg", renderSvg());

console.log("Built site/index.html, site/styles.css, site/app.js, and exports/mind-map-snapshot.svg.");

function renderHtml() {
  const payload = JSON.stringify({ data, layout });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.metadata.title)}</title>
  ${googleAnalyticsTag()}
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="mark" aria-hidden="true">${networkIcon()}</div>
        <div>
          <h1>${escapeHtml(data.metadata.title)}</h1>
          <p>${escapeHtml(data.metadata.subtitle)}</p>
        </div>
      </div>
      <div class="meta" aria-label="Source metadata">
        <span>Source: ${escapeHtml(data.metadata.sourceScope)}</span>
        <span>Updated: ${escapeHtml(data.metadata.createdAt)}</span>
      </div>
    </header>

    <main class="workspace">
      <section class="map-panel" aria-label="Interactive memory map">
        <div class="toolbar">
          <select id="clusterFilter" class="control" aria-label="Filter by cluster">
            <option value="all">All clusters</option>
          </select>
          <label class="search">
            ${searchIcon()}
            <input id="search" type="search" placeholder="Search topics, repos, workflows, evidence">
          </label>
          <select id="linkFilter" class="control" aria-label="Filter links">
            <option value="primary">Primary links</option>
            <option value="all">All links</option>
          </select>
          <button id="reset" class="control" type="button">Reset</button>
        </div>
        <div class="stage">
          <svg id="graph" role="img" aria-label="Clickable source-backed memory map"></svg>
        </div>
      </section>

      <aside id="details" class="inspector" aria-live="polite"></aside>

      <section class="readout" aria-label="Map readout">
        <div class="readout-card">
          <h2>Map Overview</h2>
          <p>${data.clusters.length} clusters, ${data.nodes.length} topics, ${data.edges.filter((edge) => edge.primary).length} primary links.</p>
          <p>Designed as a public portfolio artifact with private raw contents excluded.</p>
        </div>
        <div class="readout-card">
          <h2>Top Signals</h2>
          <ul>
            <li>Business Systems Automation is the career center.</li>
            <li>Static HTML and GitHub Pages appear as repeatable outputs.</li>
            <li>Freshness checks matter when live sites can drift.</li>
          </ul>
        </div>
        <div class="readout-card">
          <h2>Privacy Boundary</h2>
          <p>The map uses memory note references only. It excludes secrets, raw personal documents, payment data, identity document text, and local absolute paths.</p>
        </div>
      </section>
    </main>
  </div>
  <script>window.MIND_MAP_DATA = ${payload};</script>
  <script src="./app.js"></script>
</body>
</html>
`;
}

function renderSvg() {
  const width = 1600;
  const height = 1000;
  const scale = 1.08;
  const offsetX = 55;
  const offsetY = 105;
  const clusters = new Map(data.clusters.map((cluster) => [cluster.id, cluster]));
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const point = (id) => {
    const p = layout.nodes[id];
    return { x: offsetX + p.x * scale, y: offsetY + p.y * scale, radius: p.radius * scale };
  };

  const territories = layout.territories.map((territory) => `
    <rect class="territory" x="${offsetX + territory.x * scale}" y="${offsetY + territory.y * scale}" width="${territory.width * scale}" height="${territory.height * scale}" rx="34" fill="${territory.color}" stroke="${territory.color}"/>
    <text class="territory-label" x="${offsetX + (territory.x + 26) * scale}" y="${offsetY + (territory.y + 34) * scale}">${escapeHtml(territory.label)}</text>`).join("");

  const edges = data.edges
    .filter((edge) => edge.primary)
    .map((edge) => {
      const a = point(edge.source);
      const b = point(edge.target);
      const midX = (a.x + b.x) / 2;
      const risk = nodeById.get(edge.source)?.risk || nodeById.get(edge.target)?.risk;
      return `<path class="edge ${risk ? "risk" : ""}" d="M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}"/>`;
    })
    .join("");

  const nodes = data.nodes.map((node) => {
    const p = point(node.id);
    const cluster = clusters.get(node.cluster);
    const isCenter = node.id === "person:frank";
    const lines = node.displayLabel.map((line, index) => {
      const gap = isCenter ? 27 : 18;
      const y = p.y - ((node.displayLabel.length - 1) * gap) / 2 + index * gap - (isCenter ? 4 : 0);
      return `<text class="${isCenter ? "center-label" : "node-label"}" x="${p.x}" y="${y}">${escapeHtml(line)}</text>`;
    }).join("");
    const sub = isCenter ? `
      <text class="node-sub" x="${p.x}" y="${p.y + 48}">Information Designer</text>
      <text class="node-sub" x="${p.x}" y="${p.y + 65}">Systems Builder</text>` : "";
    return `<g>
      <rect class="node-card ${isCenter ? "center-card" : ""}" x="${p.x - p.radius}" y="${p.y - p.radius * 0.58}" width="${p.radius * 2}" height="${p.radius * 1.16}" rx="${isCenter ? 22 : 18}" stroke="${node.risk ? "#dc2626" : cluster.color}"/>
      <circle cx="${p.x - p.radius + 18}" cy="${p.y}" r="4.5" fill="${node.risk ? "#dc2626" : cluster.color}"/>
      ${lines}
      ${sub}
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(data.metadata.title)}</title>
  <desc id="desc">${escapeHtml(data.metadata.subtitle)}</desc>
  <defs>
    <style>
      .title { font: 760 34px Inter, ui-sans-serif, system-ui, sans-serif; fill: #111827; }
      .subtitle { font: 16px Inter, ui-sans-serif, system-ui, sans-serif; fill: #64748b; }
      .territory { fill-opacity: .45; stroke-opacity: .55; stroke-width: 1.4; }
      .territory-label { font: 760 19px Inter, ui-sans-serif, system-ui, sans-serif; fill: #334155; }
      .edge { fill: none; stroke: #2563eb; stroke-width: 2.8; opacity: .68; }
      .edge.risk { stroke: #dc2626; }
      .node-card { fill: #fff; stroke-width: 1.8; filter: drop-shadow(0 10px 18px rgba(15, 23, 42, .12)); }
      .center-card { stroke: #2563eb; stroke-width: 4; }
      .node-label { font: 760 15px Inter, ui-sans-serif, system-ui, sans-serif; fill: #111827; text-anchor: middle; dominant-baseline: middle; }
      .center-label { font: 780 24px Inter, ui-sans-serif, system-ui, sans-serif; fill: #111827; text-anchor: middle; dominant-baseline: middle; }
      .node-sub { font: 13px Inter, ui-sans-serif, system-ui, sans-serif; fill: #64748b; text-anchor: middle; }
      .readout-title { font: 760 15px Inter, ui-sans-serif, system-ui, sans-serif; fill: #111827; }
      .readout-text { font: 13px Inter, ui-sans-serif, system-ui, sans-serif; fill: #475569; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="12" fill="#fff" stroke="#cbd5e1"/>
  <text class="title" x="72" y="82">${escapeHtml(data.metadata.title)}</text>
  <text class="subtitle" x="390" y="82">${escapeHtml(data.metadata.subtitle)}</text>
  <g>${territories}</g>
  <g>${edges}</g>
  <g>${nodes}</g>
  <g>
    <rect x="72" y="890" width="1456" height="72" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
    <text class="readout-title" x="102" y="925">Source scope</text>
    <text class="readout-text" x="102" y="950">${escapeHtml(data.metadata.sourceScope)}. Raw private contents and absolute local paths are excluded.</text>
    <text class="readout-title" x="760" y="925">Map overview</text>
    <text class="readout-text" x="760" y="950">${data.clusters.length} clusters, ${data.nodes.length} topics, ${data.edges.filter((edge) => edge.primary).length} primary links. Generated from data/mind-map-snapshot.json.</text>
  </g>
</svg>
`;
}

function networkIcon() {
  return `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 5-10 5M7 7v10M17 12v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="currentColor"/><circle cx="17" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="17" r="2" fill="currentColor"/></svg>`;
}

function searchIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="#64748b" stroke-width="2"/><path d="M16.5 16.5L21 21" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function googleAnalyticsTag() {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}');
  </script>`;
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
