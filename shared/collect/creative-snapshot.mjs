// Deterministic creative snapshot builder. Joins a run's collected creatives to the durable analysis store and
// emits a static, comparable per-run state. No LLM, no network, no image reads.
import { createHash } from "node:crypto";

const KINDS = ["perception", "copy", "layout", "visual", "intent", "strategy", "ad-type"];
const AXES = [
  "appeal", "funnel_stage", "benefit_primary", "funnel_intent_stage", "visual_register",
  "scene_setting", "product_state", "composition_type", "text_density", "ad_type",
  "execution_style", "audience_read",
];

const hash = (s) => createHash("sha1").update(String(s ?? "")).digest("hex");
const basenameNoExt = (p) => String(p || "").split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") || "";
const imageRefFor = (runId, personaId, creative) => {
  if (creative?.image_ref) return creative.image_ref;
  if (creative?.image_file) return `runs/${runId}/ad-creatives/${personaId}/${creative.image_file}`;
  if (creative?.video_file) return `runs/${runId}/ad-creatives/${personaId}/${creative.video_file}`;
  return `runs/${runId}/ad-creatives/${personaId}/unknown-${hash(JSON.stringify(creative)).slice(0, 8)}`;
};

function refOf(env) {
  if (env?._ref) return env._ref;
  const slot = basenameNoExt(env?.key?.image_ref);
  return `${env?.key?.persona_id ?? "unknown"}/${slot || "unknown"}/${env?.kind ?? "unknown"}.json`;
}

function byImageAndKind(envelopes) {
  const out = new Map();
  for (const e of envelopes || []) {
    const imageRef = e?.key?.image_ref || e?.payload?.image_ref;
    if (!imageRef || !e?.kind) continue;
    let rec = out.get(imageRef);
    if (!rec) { rec = {}; out.set(imageRef, rec); }
    rec[e.kind] = e;
  }
  return out;
}

function confidenceFor(kind, payload) {
  if (!payload) return undefined;
  if (kind === "perception") return payload.observation_confidence?.text || payload.observation_confidence?.scene || payload.observation_confidence?.look || payload.observation_confidence?.geometry;
  return payload.confidence;
}

function buildRecipe(kindMap, coverage, imageRef) {
  const p = kindMap.perception?.payload;
  const copy = kindMap.copy?.payload;
  const layout = kindMap.layout?.payload;
  const visual = kindMap.visual?.payload;
  const intent = kindMap.intent?.payload;
  const strategy = kindMap.strategy?.payload;
  const adType = kindMap["ad-type"]?.payload;

  for (const k of KINDS) if (!kindMap[k]) coverage.push(`${imageRef}: missing ${k} envelope — omitted its axes`);

  const text = (p?.text_elements || []).map((t) => t.content).join("\n");
  const observed = {
    ...(p ? { text_hash: hash(text), text_element_count: (p.text_elements || []).length, graphic_element_count: (p.graphic_elements || []).length } : {}),
    ...(p?.canvas?.dominant_colors ? { dominant_colors: p.canvas.dominant_colors } : {}),
    ...(p?.not_present ? { not_present: p.not_present } : {}),
  };
  const copyEls = copy?.copy_elements || [];
  const classified = {
    ...(copyEls.length ? { text_roles: copyEls.map((e) => e.text_role).filter(Boolean) } : {}),
    ...(copyEls.some((e) => e.hook_type) ? { hook_types: copyEls.map((e) => e.hook_type).filter(Boolean) } : {}),
    ...(layout?.composition_type ? { composition_type: layout.composition_type } : {}),
    ...(layout?.text_density ? { text_density: layout.text_density } : {}),
    ...(visual?.register ? { visual_register: visual.register } : {}),
    ...(visual?.scene_class?.setting ? { scene_setting: visual.scene_class.setting } : {}),
    ...(visual?.scene_class?.product_state ? { product_state: visual.scene_class.product_state } : {}),
    ...(intent?.appeal ? { appeal: intent.appeal } : {}),
    ...(intent?.funnel_stage ? { funnel_stage: intent.funnel_stage } : {}),
    ...(strategy?.benefit_vector?.primary ? { benefit_primary: strategy.benefit_vector.primary } : {}),
    ...(strategy?.funnel_intent?.stage ? { funnel_intent_stage: strategy.funnel_intent.stage } : {}),
    ...(adType?.ad_type ? { ad_type: adType.ad_type } : {}),
    ...(adType?.execution_style ? { execution_style: adType.execution_style } : {}),
    ...(strategy?.audience_read?.primary ? { audience_read: strategy.audience_read.primary } : {}),
  };
  const confidence = {};
  for (const k of KINDS) {
    const c = confidenceFor(k, kindMap[k]?.payload);
    if (c) confidence[k === "ad-type" ? "ad_type" : k] = c;
  }
  return {
    observed,
    classified,
    ...(Object.keys(confidence).length ? { confidence } : {}),
    provenance_refs: Object.values(kindMap).filter(Boolean).map(refOf),
  };
}

function addAxis(stats, axis, value, confidence) {
  const rec = (stats[axis] ||= { counts: new Map(), total: 0, missing_count: 0, low_confidence_count: 0 });
  if (value == null || (Array.isArray(value) && value.length === 0)) {
    rec.missing_count++;
    return;
  }
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    rec.counts.set(v, (rec.counts.get(v) || 0) + 1);
    rec.total++;
  }
  if (Object.values(confidence || {}).includes("low")) rec.low_confidence_count++;
}

function finalizeAxes(stats) {
  const axes = {};
  for (const [axis, rec] of Object.entries(stats)) {
    const values = {};
    for (const [v, count] of rec.counts.entries()) values[v] = { count, share: rec.total ? Math.round((count / rec.total) * 10000) / 10000 : 0 };
    axes[axis] = {
      ...(Object.keys(values).length ? { values } : {}),
      ...(rec.missing_count ? { missing_count: rec.missing_count } : {}),
      ...(rec.low_confidence_count ? { low_confidence_count: rec.low_confidence_count } : {}),
    };
  }
  return axes;
}

export function buildCreativeSnapshot({ runId, personaId, creativeSet, envelopes = [], generatedAt } = {}) {
  if (!runId) throw new Error("buildCreativeSnapshot: runId required");
  if (!personaId) throw new Error("buildCreativeSnapshot: personaId required");
  if (!creativeSet) throw new Error("buildCreativeSnapshot: creativeSet required");
  const envByImage = byImageAndKind(envelopes);
  const coverage_flags = [];
  const axisStats = {};
  const ads = (creativeSet.creatives || []).map((creative) => {
    const image_ref = imageRefFor(runId, personaId, creative);
    const kindMap = envByImage.get(image_ref) || {};
    const static_recipe = buildRecipe(kindMap, coverage_flags, image_ref);
    for (const axis of AXES) addAxis(axisStats, axis, static_recipe.classified[axis], static_recipe.confidence);
    addAxis(axisStats, "copy_role", static_recipe.classified.text_roles, static_recipe.confidence);
    return {
      ad_key: creative.library_id || image_ref,
      ...(creative.library_id ? { library_id: creative.library_id } : {}),
      image_ref,
      ...(creative.advertiser_name ? { advertiser_name: creative.advertiser_name } : {}),
      ...(creative.status ? { status: creative.status } : {}),
      ...(creative.started_at ? { started_at: creative.started_at } : {}),
      identity_coverage: creative.library_id ? "trackable" : "local_only",
      static_recipe,
    };
  });
  return {
    snapshot_id: runId,
    run_id: runId,
    persona_id: personaId,
    ...(creativeSet.captured_at ? { captured_at: creativeSet.captured_at } : {}),
    ads,
    aggregate: { axes: finalizeAxes(axisStats) },
    coverage_flags,
    ...(generatedAt ? { generated_at: generatedAt } : {}),
  };
}

export function snapshotJoinCoverage(snapshot) {
  const ads = snapshot?.ads || [];
  const joined = ads.filter((ad) => (ad.static_recipe?.provenance_refs || []).length > 0).length;
  const total = ads.length;
  const empty = total - joined;
  return { total, joined, empty, empty_ratio: total ? empty / total : 0 };
}

export function assertSnapshotJoinCoverage(snapshot, { maxEmptyRecipeRatio = 0.5 } = {}) {
  const c = snapshotJoinCoverage(snapshot);
  if (c.total > 0 && c.empty_ratio > maxEmptyRecipeRatio) {
    throw new Error(`creative-snapshot: join coverage ${c.joined}/${c.total} below threshold — ${c.empty} ad(s) have no matching store envelopes; refuse to emit a schema-valid empty recipe snapshot`);
  }
  return c;
}
