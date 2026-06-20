// Generic collection runner — the single CLI entry for every source (replaces the per-source *-collect.mjs
// boilerplate). Dispatches by flow name via the registry, builds the query list, then hands the flow to the
// harness. Deterministic; no LLM. Manifest boundary: writes creatives + images to .generate-ads-img/runs/…
// and only the manifest path is meant to cross back to the orchestrator — never raw page bytes.
//
// Usage:
//   node shared/collect/run-flow.mjs <flow> <persona> <mode> "<query>" <run> [port] [--dry]
//        [--from-model <keyword-model.json>] [--competitors <competitors.json>] [--names "a,b"]
import { getFlow } from "./flow-registry.mjs";
import { runCollection, makeResult } from "./ad-collect-harness.mjs";
import { buildAdQueries } from "./ad-search-queries.mjs";
import { filterQueriesByModes, safeName } from "./ad-source-helpers.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

// Side-effecting CLI body runs only on direct invocation — importing this module must do nothing
// (so it stays testable and free of surprise process.exit / network on require).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
const argv = process.argv.slice(2);
const argVal = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null; };
const FLAG_TAKES_VALUE = new Set(["--from-model", "--competitors", "--names"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !FLAG_TAKES_VALUE.has(argv[i - 1]));
const [flowName, personaId, mode = "keyword", query = "", runId = "adlib", portArg] = positional;
const PORT = Number(portArg) || 9291;
const dry = argv.includes("--dry");

if (!flowName || !personaId) {
  console.error('Usage: node shared/collect/run-flow.mjs <flow> <persona> <mode> "<query>" <run> [port] [--dry] [--from-model f] [--competitors f] [--names "a,b"]');
  process.exit(2);
}
safeName(personaId, "persona"); safeName(runId, "run");
const flow = getFlow(flowName);

// confirmed competitor names: from a competitors.json (status=confirmed) or inline --names
const competitorsPath = argVal("--competitors");
const namesArg = argVal("--names");
let names = [];
if (competitorsPath) names = (JSON.parse(readFileSync(competitorsPath, "utf8")).competitors || []).filter((c) => c.status === "confirmed").map((c) => c.name);
else if (namesArg) names = namesArg.split(",").map((s) => s.trim()).filter(Boolean);

// query list: keyword-model (+ competitors) → buildAdQueries; else single positional; then keep only modes the flow accepts
const modelPath = argVal("--from-model");
let queries;
if (modelPath || names.length) {
  const km = modelPath ? JSON.parse(readFileSync(modelPath, "utf8")) : null;
  queries = buildAdQueries({ keywordModel: km, competitors: names });
} else {
  queries = query ? [{ mode, query }] : [];
}
queries = filterQueriesByModes(queries, flow.acceptModes);

if (dry) {
  // Dry-run = offline manifest shape only (no network), for harness/e2e smoke.
  const outDir = `.generate-ads-img/runs/${runId}/ad-creatives/${personaId}`;
  mkdirSync(`${outDir}/images`, { recursive: true });
  const result = makeResult({ personaId, source: flow.source, queries, mode: queries[0]?.mode || mode });
  result.captured_at = "dry-run";
  result.creatives.push({ image_url: "https://example.test/dry.jpg", image_file: "images/ad-0.jpg", subtype: "single_image", type: "ad_creative", confidence: 1 });
  result.coverage_flags.push("dry-run: no network");
  writeFileSync(`${outDir}/ad-creative.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(`SAVED ${result.creatives.length} creatives from ${flow.source} (dry) → ${outDir}/ad-creative.json`);
} else {
  await runCollection({ adapter: flow, queries, personaId, runId, port: PORT });
}
}
