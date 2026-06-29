// Harness: build a creative-snapshot for one persona/run from collected creatives + durable store.
// Usage: node shared/harness/build-creative-snapshot.mjs <persona_id> <run_id> [out_run_id]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertSnapshotJoinCoverage, buildCreativeSnapshot } from "../collect/creative-snapshot.mjs";
import { loadEnvelopes } from "../lineage/read-store.mjs";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const STATE_DIR = resolve(process.env.GEN_ADS_IMG_STATE || resolve(process.cwd(), ".generate-ads-img"));
const statePath = (p) => resolve(STATE_DIR, p);
const loadState = (p) => JSON.parse(readFileSync(statePath(p), "utf8"));
const writeState = (p, data) => {
  const abs = statePath(p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
};

const [personaId, runId, outRunIdArg] = process.argv.slice(2);
if (!personaId || !runId) {
  console.error("Usage: node shared/harness/build-creative-snapshot.mjs <persona_id> <run_id> [out_run_id]");
  process.exit(2);
}

const creativeRel = `runs/${runId}/ad-creatives/${personaId}/ad-creative.json`;
if (!existsSync(statePath(creativeRel))) {
  console.error(`No collection snapshot found at ${STATE_DIR}/${creativeRel}`);
  process.exit(1);
}

let envelopes;
try { envelopes = loadEnvelopes(personaId, { stateDir: STATE_DIR }); }
catch (e) { console.error(`creative-snapshot: ${e.message}`); process.exit(1); }

const snapshot = buildCreativeSnapshot({ runId, personaId, creativeSet: loadState(creativeRel), envelopes, generatedAt: new Date().toISOString() });
try {
  assertSnapshotJoinCoverage(snapshot, { maxEmptyRecipeRatio: Number(process.env.CREATIVE_SNAPSHOT_MAX_EMPTY_RECIPE_RATIO ?? 0.5) });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const outRunId = outRunIdArg || runId;
const outRel = `runs/${outRunId}/creative-change/creative-snapshot.${runId}.json`;
writeState(outRel, snapshot);
const ok = report("creative-snapshot written", validateAgainst("creative-snapshot.schema.json", snapshot));
console.log(`  → ${STATE_DIR}/${outRel} (${snapshot.ads.length} ads)`);
process.exit(ok ? 0 : 1);
