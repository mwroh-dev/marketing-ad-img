import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvelopes, loadByKind, loadMatrixInputs } from "./read-store.mjs";

const TMP = join(tmpdir(), "gai-read-store-test");
const STATE = join(TMP, ".generate-ads-img");
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);

const env = (kind, image_ref, payload) => ({
  kind, key: { persona_id: "p", image_ref }, pattern_tag: "t:function×discovery",
  derived_from: [], logic_version: { version: "v1", method: "content" },
  produced_by: "x", stamped_at: "2026-06-27T00:00:00.000Z", payload,
});
function write(slot, kind, image_ref, payload) {
  const fp = join(STATE, "store", "p", slot, `${kind}.json`);
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, JSON.stringify(env(kind, image_ref, payload)));
}

// THE INTERLOCK — the reason this reader exists.
test("INTERLOCK: missing store → throws (generation cannot proceed)", () => {
  reset(); mkdirSync(STATE, { recursive: true });
  assert.throws(() => loadEnvelopes("p", { stateDir: STATE }), /store empty/);
  assert.throws(() => loadMatrixInputs("p", { stateDir: STATE }), /store empty/);
});

test("INTERLOCK: store dir exists but no envelopes → throws", () => {
  reset(); mkdirSync(join(STATE, "store", "p"), { recursive: true });
  assert.throws(() => loadEnvelopes("p", { stateDir: STATE }), /no envelopes/);
});

test("populated store → loadMatrixInputs returns strategy + ad-type payloads, image_ref from the envelope key", () => {
  reset();
  write("ad-0", "strategy", "runs/r/ad-0.jpg", { benefit_vector: { primary: "function" }, funnel_intent: { stage: "discovery" } });
  write("ad-0", "ad-type", "runs/r/ad-0.jpg", { ad_type: "informational" });
  write("ad-1", "strategy", "runs/r/ad-1.jpg", { benefit_vector: { primary: "trust" }, funnel_intent: { stage: "action" } });
  const { strategies, adTypes } = loadMatrixInputs("p", { stateDir: STATE });
  assert.equal(strategies.length, 2);
  assert.equal(adTypes.length, 1);
  // image_ref is injected from the key even though the analyst payload omitted it (authoritative identity).
  assert.deepEqual(strategies.map((s) => s.image_ref).sort(), ["runs/r/ad-0.jpg", "runs/r/ad-1.jpg"]);
  assert.equal(adTypes[0].image_ref, "runs/r/ad-0.jpg");
  assert.equal(adTypes[0].ad_type, "informational");
});

test("JOIN GUARD: a strategy/ad-type envelope missing key.image_ref → loadMatrixInputs throws (no silent cross-join)", () => {
  reset();
  // a strategy envelope whose key has NO image_ref — would otherwise collapse into one matrix bucket
  const fp = join(STATE, "store", "p", "ad-0", "strategy.json");
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, JSON.stringify(env("strategy", undefined, { benefit_vector: { primary: "function" } })));
  assert.throws(() => loadMatrixInputs("p", { stateDir: STATE }), /store corrupted/);
});

test("CORRUPT GUARD: an unparseable envelope file → throws naming the file (not a generic JSON error)", () => {
  reset();
  const fp = join(STATE, "store", "p", "ad-0", "perception.json");
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, "{ not valid json");
  assert.throws(() => loadEnvelopes("p", { stateDir: STATE }), /store corrupted: failed to parse envelope.*perception\.json/);
});

test("FAIL FAST: store has envelopes but zero strategy → loadMatrixInputs throws (no silent 0-ad matrix)", () => {
  reset();
  write("ad-0", "ad-type", "runs/r/ad-0.jpg", { ad_type: "informational" });  // store non-empty, but no strategy
  assert.throws(() => loadMatrixInputs("p", { stateDir: STATE }), /no 'strategy' envelopes/);
});

test("loadEnvelopes accepts candidate-keyed generation envelopes (no image_ref) — the image_ref guard belongs at the matrix join, not here", () => {
  reset();
  const fp = join(STATE, "store", "p", "cand-1", "creative-candidate.json");
  mkdirSync(resolve(fp, ".."), { recursive: true });
  writeFileSync(fp, JSON.stringify({
    kind: "creative-candidate", key: { persona_id: "p", candidate_id: "cand-1" }, pattern_tag: "gen:function×discovery",
    derived_from: [], logic_version: { version: "v1", method: "content" },
    produced_by: "finalize-candidates", stamped_at: "2026-06-27T00:00:00.000Z", payload: { candidate_id: "cand-1" },
  }));
  assert.equal(loadEnvelopes("p", { stateDir: STATE }).length, 1);   // no throw — candidate envelopes are valid in the store
});

test("loadByKind filters one kind and injects image_ref", () => {
  reset();
  write("ad-0", "perception", "runs/r/ad-0.jpg", { medium: "flat" });
  write("ad-0", "copy", "runs/r/ad-0.jpg", { headline: "x" });
  const perc = loadByKind("p", "perception", { stateDir: STATE });
  assert.equal(perc.length, 1);
  assert.equal(perc[0].medium, "flat");
  assert.equal(perc[0].image_ref, "runs/r/ad-0.jpg");
});
