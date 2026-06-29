import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { persistArtifact, analysisPatternTag } from "../lineage/persist-artifact.mjs";

const BUILD = resolve("shared/harness/build-creative-snapshot.mjs");
const PERSONA = "p";

function writeJson(state, rel, data) {
  const p = join(state, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function imageRef(run, imageFile) {
  return `runs/${run}/ad-creatives/${PERSONA}/${imageFile}`;
}

function payloads(ref, appeal) {
  return {
    perception: { image_ref: ref, persona_id: PERSONA, canvas: { dominant_colors: ["#fff"] }, text_elements: [{ id: "t1", content: `headline-${appeal}` }], graphic_elements: [], observation_confidence: { text: "high" } },
    intent: { image_ref: ref, persona_id: PERSONA, appeal, funnel_stage: "consideration", confidence: "high" },
    strategy: { image_ref: ref, persona_id: PERSONA, benefit_vector: { primary: "trust" }, funnel_intent: { stage: "comparison" }, grounds_in: "test" },
    "ad-type": { image_ref: ref, persona_id: PERSONA, ad_type: "social_proof", execution_style: "testimonial", grounds_in: "test" },
  };
}

function persistRun(state, run, appeal) {
  const creatives = [0, 1, 2].map((i) => ({ library_id: `L${i + 1}`, image_file: `images/ad-${i}.jpg`, started_at: "2026-05-01", status: "active", advertiser_name: "adv" }));
  writeJson(state, `runs/${run}/ad-creatives/${PERSONA}/ad-creative.json`, { persona_id: PERSONA, captured_at: "2026-06-01", creatives });
  for (const creative of creatives) {
    const ref = imageRef(run, creative.image_file);
    const pl = payloads(ref, appeal);
    const pattern_tag = analysisPatternTag(pl.strategy, pl["ad-type"]);
    for (const [kind, payload] of Object.entries(pl)) {
      persistArtifact({ kind, key: { persona_id: PERSONA, image_ref: ref, run_id: run }, payload, pattern_tag, produced_by: "fixture" }, { stateDir: state });
    }
  }
}

test("build-creative-snapshot CLI fails closed when store envelopes no longer join the selected run", () => {
  const state = mkdtempSync(join(tmpdir(), "gai-creative-snapshot-clobber-"));
  persistRun(state, "run-a", "quality_proof");
  persistRun(state, "run-b", "emotional");

  assert.throws(
    () => execFileSync("node", [BUILD, PERSONA, "run-a", "analysis-run"], {
      env: { ...process.env, GEN_ADS_IMG_STATE: state },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
    /join coverage .*below/,
  );
});

