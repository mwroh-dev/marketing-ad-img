import test from "node:test";
import assert from "node:assert/strict";
import { buildCreativeSnapshot } from "./creative-snapshot.mjs";
import { validateAgainst } from "./schema-validate.mjs";

const env = (kind, image_ref, payload, ref = `p/ad-0/${kind}.json`) => ({
  kind,
  key: { persona_id: "p", image_ref, run_id: "run-a" },
  pattern_tag: "default:trust×comparison",
  derived_from: [],
  logic_version: { version: "test", method: "content" },
  produced_by: "test",
  stamped_at: "2026-06-01T00:00:00Z",
  payload,
  _ref: ref,
});

test("buildCreativeSnapshot joins collected creatives to store envelopes and aggregates comparable axes", () => {
  const imageRef = "runs/run-a/ad-creatives/p/images/ad-0.jpg";
  const creativeSet = {
    persona_id: "p",
    captured_at: "2026-06-01",
    creatives: [{ library_id: "L1", image_file: "images/ad-0.jpg", started_at: "2026-05-01", status: "active", advertiser_name: "adv_a" }],
  };
  const snapshot = buildCreativeSnapshot({
    runId: "run-a",
    personaId: "p",
    creativeSet,
    envelopes: [
      env("perception", imageRef, {
        image_ref: imageRef,
        persona_id: "p",
        canvas: { dominant_colors: ["#fff"] },
        text_elements: [{ id: "t1", content: "Proof headline" }],
        graphic_elements: [{ id: "g1", kind: "badge" }],
        not_present: ["no_price"],
        observation_confidence: { text: "high" },
      }),
      env("copy", imageRef, { image_ref: imageRef, persona_id: "p", copy_elements: [{ content: "Proof headline", text_role: "headline", hook_type: "result", confidence: "high" }] }),
      env("layout", imageRef, { image_ref: imageRef, persona_id: "p", composition_type: "review_capture", text_density: "medium", comfort: { crowding: 0.2, awkward_placement: false, breathing_room: true }, confidence: "high" }),
      env("visual", imageRef, { image_ref: imageRef, persona_id: "p", medium: "photo", scene_class: { setting: "studio_plain", product_state: "standalone", prop_density: "minimal" }, register: "clean_minimal", confidence: "high" }),
      env("intent", imageRef, { image_ref: imageRef, persona_id: "p", appeal: "quality_proof", funnel_stage: "consideration", confidence: "high" }),
      env("strategy", imageRef, { image_ref: imageRef, persona_id: "p", benefit_vector: { primary: "trust", evidence: [{ source: "headline", reason: "proof" }] }, funnel_intent: { stage: "comparison", evidence: [{ source: "headline", reason: "proof" }] }, first_cognition: { target_clarity: 1, situation_clarity: 1, problem_clarity: 1, product_category_clarity: 1, benefit_clarity: 2, reading_load: 1, jargon_penalty: 0, visual_legibility: 2, total_score: 9, verdict: "acceptable" }, audience_read: { primary: "proof_seeker", evidence: [{ source: "copy", reason: "proof language" }], confidence: "high" }, grounds_in: "test" }),
      env("ad-type", imageRef, { image_ref: imageRef, persona_id: "p", message_basis: "informational", execution_style: "testimonial", ad_type: "social_proof", grounds_in: "test" }),
    ],
  });

  assert.equal(snapshot.snapshot_id, "run-a");
  assert.equal(snapshot.ads[0].ad_key, "L1");
  assert.equal(snapshot.ads[0].identity_coverage, "trackable");
  assert.equal(snapshot.ads[0].static_recipe.classified.appeal, "quality_proof");
  assert.equal(snapshot.ads[0].static_recipe.classified.audience_read, "proof_seeker");
  assert.equal(snapshot.aggregate.axes.appeal.values.quality_proof.count, 1);
  assert.equal(snapshot.coverage_flags.length, 0);
  const validation = validateAgainst("creative-snapshot.schema.json", snapshot);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});

test("buildCreativeSnapshot keeps untrackable ads and flags missing analysis axes", () => {
  const snapshot = buildCreativeSnapshot({
    runId: "run-a",
    personaId: "p",
    creativeSet: { persona_id: "p", captured_at: "2026-06-01", creatives: [{ image_file: "images/ad-9.jpg" }] },
    envelopes: [],
  });

  assert.equal(snapshot.ads[0].identity_coverage, "local_only");
  assert.match(snapshot.ads[0].ad_key, /runs\/run-a/);
  assert.ok(snapshot.coverage_flags.some((f) => /missing perception/.test(f)));
  assert.equal(snapshot.aggregate.axes.appeal.values, undefined);
  const validation = validateAgainst("creative-snapshot.schema.json", snapshot);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});
