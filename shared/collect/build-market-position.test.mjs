import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildMarketPosition, buildMarketPositionFromStore } from "./build-market-position.mjs";

const TMP = join(tmpdir(), "gai-build-mp-test");
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);

// store fixture: a complete lineage envelope at store/{persona}/{slot}/{kind}.json
const STORE = join(TMP, "state");
function storeEnv(persona, slot, kind, image_ref, payload) {
  const fp = join(STORE, ".generate-ads-img", "store", persona, slot, `${kind}.json`);
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, JSON.stringify({
    kind, key: { persona_id: persona, image_ref }, pattern_tag: "t:function×discovery",
    derived_from: [], logic_version: { version: "v1", method: "content" },
    produced_by: "x", stamped_at: "2026-06-27T00:00:00.000Z", payload,
  }));
}
const STATE_DIR = join(STORE, ".generate-ads-img");

// the analysts' real per-kind layout: analysis/strategy/strategy-{i}.json + analysis/type/type-{i}.json
function ad(i, benefit, funnel) {
  const sdir = join(TMP, "analysis", "strategy"); const tdir = join(TMP, "analysis", "type");
  mkdirSync(sdir, { recursive: true }); mkdirSync(tdir, { recursive: true });
  writeFileSync(join(sdir, `strategy-${i}.json`), JSON.stringify({
    benefit_vector: { primary: benefit }, funnel_intent: { stage: funnel },
    generation_reusability: { usable: true, reusable_devices: ["device-a"] },
  }));
  writeFileSync(join(tdir, `type-${i}.json`), JSON.stringify({ ad_type: "lifestyle", execution_style: "in_situ" }));
}

test("buildMarketPosition produces a schema-conformant matrix from per-ad strategy files", () => {
  reset();
  ad(0, "function", "discovery");
  ad(1, "trust", "comparison");
  const out = buildMarketPosition({ analysisDir: join(TMP, "analysis"), personaId: "exam-study", now: "2026-06-27T00:00:00.000Z" });

  assert.equal(out.persona_id, "exam-study");
  assert.equal(out.total_ads, 2);
  assert.ok(out.by_benefit_and_funnel, "has the benefit×funnel grid");

  // the real contract: conform to the migrated schema (the gate the live run failed)
  const schema = JSON.parse(readFileSync(resolve("schemas/analysis/market-position-matrix.schema.json"), "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
  const ok = ajv.compile(schema)(out);
  assert.ok(ok, "matrix must conform to market-position-matrix.schema.json — " + JSON.stringify(ajv.errors));
});

test("ad indices without a strategy projection are skipped (no fake data)", () => {
  reset();
  ad(0, "function", "discovery");
  // index 1 has a type but no strategy → not a record (indices come from the strategy dir)
  mkdirSync(join(TMP, "analysis", "type"), { recursive: true });
  writeFileSync(join(TMP, "analysis", "type", "type-1.json"), JSON.stringify({ ad_type: "lifestyle" }));
  const out = buildMarketPosition({ analysisDir: join(TMP, "analysis"), personaId: "p", now: "2026-06-27T00:00:00.000Z" });
  assert.equal(out.total_ads, 1);
});

test("STORE MODE: buildMarketPositionFromStore builds a conformant matrix from the durable store", () => {
  reset();
  const P = "exam-study";
  storeEnv(P, "ad-0", "strategy", "runs/r/ad-0.jpg", { benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" }, generation_reusability: { usable: true, reusable_devices: ["device-a"] } });
  storeEnv(P, "ad-0", "ad-type", "runs/r/ad-0.jpg", { ad_type: "lifestyle", execution_style: "in_situ" });
  storeEnv(P, "ad-1", "strategy", "runs/r/ad-1.jpg", { benefit_vector: { primary: "trust" }, funnel_intent: { stage: "comparison" }, generation_reusability: { usable: true, reusable_devices: ["device-b"] } });
  const out = buildMarketPositionFromStore({ persona: P, stateDir: STATE_DIR, now: "2026-06-27T00:00:00.000Z" });
  assert.equal(out.persona_id, P);
  assert.equal(out.total_ads, 2);
  const schema = JSON.parse(readFileSync(resolve("schemas/analysis/market-position-matrix.schema.json"), "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
  assert.ok(ajv.compile(schema)(out), "store-built matrix must conform — " + JSON.stringify(ajv.errors));
});

test("STORE MODE INTERLOCK: an empty/absent store throws (generation cannot build a matrix from scratch)", () => {
  reset();
  mkdirSync(STATE_DIR, { recursive: true });
  assert.throws(() => buildMarketPositionFromStore({ persona: "nobody", stateDir: STATE_DIR }), /store empty/);
});
