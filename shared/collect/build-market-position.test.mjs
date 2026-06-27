import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildMarketPosition } from "./build-market-position.mjs";

const TMP = join(tmpdir(), "gai-build-mp-test");
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);

function ad(slot, benefit, funnel) {
  const dir = join(TMP, "analysis", slot);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "strategy.json"), JSON.stringify({
    benefit_vector: { primary: benefit }, funnel_intent: { stage: funnel },
    generation_reusability: { usable: true, reusable_devices: ["device-a"] },
  }));
  writeFileSync(join(dir, "ad-type.json"), JSON.stringify({ ad_type: "lifestyle", execution_style: "in_situ" }));
}

test("buildMarketPosition produces a schema-conformant matrix from per-ad strategy files", () => {
  reset();
  ad("ad-0", "function", "discovery");
  ad("ad-1", "trust", "comparison");
  const out = buildMarketPosition({ analysisDir: join(TMP, "analysis"), personaId: "exam-study", productId: "pomodoro-timer", now: "2026-06-27T00:00:00.000Z" });

  assert.equal(out.persona_id, "exam-study");
  assert.equal(out.total_ads, 2);
  assert.ok(out.by_benefit_and_funnel, "has the benefit×funnel grid");

  // the real contract: conform to the migrated schema (the gate the live run failed)
  const schema = JSON.parse(readFileSync(resolve("schemas/analysis/market-position-matrix.schema.json"), "utf8"));
  const ajv = new Ajv2020({ strict: false, allErrors: true }); addFormats(ajv);
  const ok = ajv.compile(schema)(out);
  assert.ok(ok, "matrix must conform to market-position-matrix.schema.json — " + JSON.stringify(ajv.errors));
});

test("ads without a strategy projection are skipped (no fake data)", () => {
  reset();
  ad("ad-0", "function", "discovery");
  mkdirSync(join(TMP, "analysis", "ad-1"), { recursive: true }); // no strategy.json
  const out = buildMarketPosition({ analysisDir: join(TMP, "analysis"), personaId: "p", now: "2026-06-27T00:00:00.000Z" });
  assert.equal(out.total_ads, 1);
});
