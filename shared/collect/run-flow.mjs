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
import { datedRunId, buildCollectedManifest, writeRunManifest } from "./run-manifest.mjs";
import { acquirePort } from "./acquire-port.mjs";
import { launchChrome, endpointReady } from "./launch-chrome.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";

// Side-effecting CLI body runs only on direct invocation — importing this module must do nothing
// (so it stays testable and free of surprise process.exit / network on require).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
const argv = process.argv.slice(2);
const argVal = (flag) => { const i = argv.indexOf(flag); return i > -1 ? argv[i + 1] : null; };
const FLAG_TAKES_VALUE = new Set(["--from-model", "--from-keyword-plan", "--competitors", "--names", "--images", "--images-per-keyword"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !FLAG_TAKES_VALUE.has(argv[i - 1]));
const [flowName, personaId, mode = "keyword", query = "", runIdArg = "", portArg] = positional;
const dry = argv.includes("--dry");

if (!flowName || !personaId) {
  console.error('Usage: node shared/collect/run-flow.mjs <flow> <persona> <mode> "<query>" <run> [port] [--dry] [--from-keyword-plan f] [--from-model f] [--competitors f] [--names "a,b"]');
  process.exit(2);
}
safeName(personaId, "persona");
const flow = getFlow(flowName);

// confirmed competitor names: from a competitors.json (status=confirmed) or inline --names
const competitorsPath = argVal("--competitors");
const namesArg = argVal("--names");
let names = [];
if (competitorsPath) names = (JSON.parse(readFileSync(competitorsPath, "utf8")).competitors || []).filter((c) => c.status === "confirmed").map((c) => c.name);
else if (namesArg) names = namesArg.split(",").map((s) => s.trim()).filter(Boolean);

// query list precedence: keyword-plan (3-axis LLM plan) → keyword-model → single positional. Confirmed
// competitors (advertiser mode) are appended on top of whichever keyword source is used.
const planPath = argVal("--from-keyword-plan");
const modelPath = argVal("--from-model");
let queries;
let productId = null;
if (planPath) {
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  productId = plan.product_id ?? null;
  const kw = (plan.queries || []).map((q) => ({ mode: "keyword", query: q.query, axis: q.axis }));
  queries = [...kw, ...(names.length ? buildAdQueries({ competitors: names }) : [])];
} else if (modelPath || names.length) {
  const km = modelPath ? JSON.parse(readFileSync(modelPath, "utf8")) : null;
  queries = buildAdQueries({ keywordModel: km, competitors: names });
} else {
  queries = query ? [{ mode, query }] : [];
}
queries = filterQueriesByModes(queries, flow.acceptModes);

// run id: explicit positional wins; else auto-generate a dated id (the old "adlib" default overwrote prior runs).
const runId = runIdArg && runIdArg !== "adlib" ? runIdArg : datedRunId(flow.source, queries[0]?.mode || mode);
safeName(runId, "run");
const track = queries.some((q) => q.mode === "advertiser") ? "competitor" : "category_keyword";

// Budget = IMAGES (videos collected incidentally, uncapped). Tunable via --images / --images-per-keyword.
// Fall back to the default on an absent OR non-numeric value (a NaN limit would disable the cap → runaway).
const numArg = (flag, def) => { const v = argVal(flag); const n = Number(v); return v != null && !Number.isNaN(n) ? n : def; };
const totalImages = numArg("--images", 50);
const imagesPerQuery = numArg("--images-per-keyword", 8);

let result;
if (dry) {
  // Dry-run = offline manifest shape only (no network), for harness/e2e smoke.
  const outDir = `.generate-ads-img/runs/${runId}/ad-creatives/${personaId}`;
  mkdirSync(`${outDir}/images`, { recursive: true });
  result = makeResult({ personaId, source: flow.source, queries, mode: queries[0]?.mode || mode });
  result.captured_at = "dry-run";
  result.creatives.push({ image_url: "https://example.test/dry.jpg", image_file: "images/ad-0.jpg", subtype: "single_image", type: "ad_creative", confidence: 1 });
  result.coverage_flags.push("dry-run: no network");
  writeFileSync(`${outDir}/ad-creative.json`, JSON.stringify(result, null, 2) + "\n");
  console.log(`SAVED ${result.creatives.length} creatives from ${flow.source} (dry) → ${outDir}/ad-creative.json`);
} else {
  // run-flow owns the full CDP lifecycle — the runbook's "every collection run owns its browser through code,
  // no manual Chrome launch" contract (data-collection.md). Acquire a probed-free port, launch a dedicated
  // headless Chrome on it (non-intrusive: --headless=new + isolated --user-data-dir), collect, ALWAYS close.
  // An explicit [port] positional — or a Chrome already answering CDP on it — is honored: connect, don't relaunch.
  const port = Number(portArg) || acquirePort("adlib-collect").port;
  const chrome = endpointReady(port) ? null : await launchChrome({ port, userDataDir: `/tmp/gai-adlib-${port}` });
  try {
    result = await runCollection({ adapter: flow, queries, personaId, runId, port, totalImages, imagesPerQuery });
  } finally {
    if (chrome) await chrome.close();
  }
}

// per-run progress ledger — dated id + stage. The human keep/delete gate, the deterministic screen, and
// analysis advance the stage from here (collected → human_reviewed → screened → analyzed) via advance-stage.mjs.
writeRunManifest(runId, buildCollectedManifest({
  runId, source: flow.source, track, personaId, productId, queries, collected: result.creatives.length,
}));
console.log(`MANIFEST → .generate-ads-img/runs/${runId}/run.json (stage=collected, collected=${result.creatives.length})`);
}
