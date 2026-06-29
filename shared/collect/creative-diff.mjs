// Deterministic comparison of two creative snapshots. Produces computed edges only.
const AXES = ["appeal", "funnel_stage", "benefit_primary", "funnel_intent_stage", "visual_register", "scene_setting", "product_state", "composition_type", "text_density", "copy_role", "ad_type", "execution_style", "audience_read"];

const ref = (ad) => ({ ad_key: ad.ad_key, ...(ad.library_id ? { library_id: ad.library_id } : {}), image_ref: ad.image_ref });
const mapTrackable = (snapshot) => new Map((snapshot.ads || []).filter((a) => a.library_id).map((a) => [a.library_id, a]));
const floorConfidence = (a, b) => (a === "low" || b === "low" ? "low" : a === "medium" || b === "medium" ? "medium" : a || b || undefined);

function axisShare(snapshot, axis) {
  const values = {};
  let total = 0, low = 0, missing = 0;
  for (const ad of snapshot.ads || []) {
    const recipe = ad.static_recipe || {};
    const value = axis === "copy_role" ? recipe.classified?.text_roles : recipe.classified?.[axis];
    const vals = Array.isArray(value) ? value : value == null ? [] : [value];
    if (!vals.length) { missing++; continue; }
    for (const v of vals) { values[v] = (values[v] || 0) + 1; total++; }
    if (Object.values(recipe.confidence || {}).includes("low")) low++;
  }
  const shares = {};
  for (const [k, count] of Object.entries(values)) shares[k] = { count, share: total ? Math.round((count / total) * 10000) / 10000 : 0 };
  return { total, low, missing, shares };
}

function distributionDelta(from, to) {
  const out = {};
  for (const axis of AXES) {
    const a = axisShare(from, axis), b = axisShare(to, axis);
    const keys = [...new Set([...Object.keys(a.shares), ...Object.keys(b.shares)])].sort();
    const values = {};
    for (const k of keys) {
      const fromShare = a.shares[k]?.share || 0;
      const toShare = b.shares[k]?.share || 0;
      values[k] = {
        from: fromShare,
        to: toShare,
        delta: Math.round((toShare - fromShare) * 10000) / 10000,
        support_count: (a.shares[k]?.count || 0) + (b.shares[k]?.count || 0),
      };
    }
    out[axis] = {
      from_count: a.total,
      to_count: b.total,
      ...(a.low || b.low ? { confidence_floor: "low" } : {}),
      ...(!a.total && !b.total ? { missing_axis: true } : {}),
      values,
    };
  }
  return out;
}

function changedAxes(a, b) {
  const before = {}, after = {}, axes = [];
  const ar = a.static_recipe || {}, br = b.static_recipe || {};
  if (ar.observed?.text_hash !== br.observed?.text_hash) {
    axes.push("text_hash"); before.text_hash = ar.observed?.text_hash; after.text_hash = br.observed?.text_hash;
  }
  if (ar.observed?.image_asset_hash !== br.observed?.image_asset_hash && (ar.observed?.image_asset_hash || br.observed?.image_asset_hash)) {
    axes.push("image_asset_hash"); before.image_asset_hash = ar.observed?.image_asset_hash; after.image_asset_hash = br.observed?.image_asset_hash;
  }
  for (const axis of AXES.filter((x) => x !== "copy_role")) {
    if (ar.classified?.[axis] !== br.classified?.[axis]) {
      axes.push(axis); before[axis] = ar.classified?.[axis]; after[axis] = br.classified?.[axis];
    }
  }
  return { axes, before, after };
}

export function compareCreativeSnapshots(from, to, { generatedAt } = {}) {
  if (!from || !to) throw new Error("compareCreativeSnapshots: from and to snapshots required");
  const fromMap = mapTrackable(from), toMap = mapTrackable(to);
  const created = [], deleted = [], persisted = [], untrackable = [];
  for (const ad of to.ads || []) {
    if (!ad.library_id) { untrackable.push(ref(ad)); continue; }
    if (!fromMap.has(ad.library_id)) created.push(ref(ad));
    else persisted.push(ref(ad));
  }
  for (const ad of from.ads || []) {
    if (!ad.library_id) { untrackable.push(ref(ad)); continue; }
    if (!toMap.has(ad.library_id)) deleted.push(ref(ad));
  }
  const changed = [];
  for (const id of [...fromMap.keys()].filter((id) => toMap.has(id)).sort()) {
    const c = changedAxes(fromMap.get(id), toMap.get(id));
    if (c.axes.length) changed.push({ library_id: id, changed_axes: c.axes, before: c.before, after: c.after, evidence_refs: [...(fromMap.get(id).static_recipe?.provenance_refs || []), ...(toMap.get(id).static_recipe?.provenance_refs || [])] });
  }
  const coverage_flags = [...(from.coverage_flags || []), ...(to.coverage_flags || [])];
  if (untrackable.length) coverage_flags.push(`${untrackable.length} ad(s) lack library_id — excluded from cross-snapshot inventory claims`);
  if (((from.ads || []).length + (to.ads || []).length) > 0 && !fromMap.size && !toMap.size) {
    coverage_flags.push("all ads lack library_id — inventory create/delete/persisted claims unavailable");
  }
  return {
    from_snapshot_id: from.snapshot_id,
    to_snapshot_id: to.snapshot_id,
    persona_id: to.persona_id || from.persona_id,
    inventory_delta: { created, deleted, persisted, untrackable },
    update_delta: { same_library_id_changed_recipe: changed },
    distribution_delta: distributionDelta(from, to),
    coverage_flags,
    ...(generatedAt ? { generated_at: generatedAt } : {}),
  };
}
