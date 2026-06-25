import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("data/mind-map-snapshot.json", "utf8"));
const layout = JSON.parse(fs.readFileSync("src/layout.json", "utf8"));
const errors = [];
const clusterIds = new Set(data.clusters.map((cluster) => cluster.id));
const nodeIds = new Set();

function fail(message) {
  errors.push(message);
}

if (!data.metadata?.title || !data.metadata?.subtitle) {
  fail("metadata.title and metadata.subtitle are required");
}

for (const cluster of data.clusters) {
  if (!cluster.id || !cluster.label || !cluster.color || !cluster.description) {
    fail(`cluster ${cluster.id || "(missing id)"} is missing id, label, color, or description`);
  }
}

for (const node of data.nodes) {
  if (nodeIds.has(node.id)) fail(`duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  for (const field of ["id", "label", "publicLabel", "displayLabel", "type", "cluster", "summary", "confidence", "privacyLevel", "weight"]) {
    if (node[field] === undefined || node[field] === null || node[field] === "") fail(`node ${node.id} missing ${field}`);
  }
  if (!Array.isArray(node.displayLabel) || node.displayLabel.length === 0) fail(`node ${node.id} needs displayLabel array`);
  if (!clusterIds.has(node.cluster)) fail(`node ${node.id} has invalid cluster ${node.cluster}`);
  if (!layout.nodes[node.id]) fail(`node ${node.id} missing layout coordinates`);
}

for (const id of Object.keys(layout.nodes)) {
  if (!nodeIds.has(id)) fail(`layout contains unknown node ${id}`);
}

for (const edge of data.edges) {
  if (!nodeIds.has(edge.source)) fail(`edge has unknown source ${edge.source}`);
  if (!nodeIds.has(edge.target)) fail(`edge has unknown target ${edge.target}`);
  if (!edge.type || !edge.label || typeof edge.weight !== "number") fail(`edge ${edge.source} -> ${edge.target} missing type, label, or numeric weight`);
}

const publicFiles = ["README.md", "data/mind-map-snapshot.json", "src/client.js", "src/styles.css"];
for (const file of publicFiles) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (/\/Users\/poweruser\//.test(text)) fail(`${file} leaks an absolute local path`);
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${data.nodes.length} nodes, ${data.edges.length} edges, ${data.clusters.length} clusters.`);
