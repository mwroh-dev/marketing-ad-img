// Deterministic promotion of creative diffs into change candidates. No interpretation.
const TYPE_BY_AXIS = {
  appeal: "appeal_shift",
  funnel_stage: "funnel_shift",
  funnel_intent_stage: "funnel_shift",
  benefit_primary: "benefit_shift",
  visual_register: "visual_register_shift",
  composition_type: "layout_shift",
  text_density: "layout_shift",
  copy_role: "copy_role_shift",
  audience_read: "audience_read_shift",
};

function strengthFor(absDelta, confidenceFloor, { strongShareDelta }) {
  const s = absDelta >= strongShareDelta ? "strong" : "medium";
  return confidenceFloor === "low" && s === "strong" ? "medium" : s;
}

export function detectChangeCandidates(diff, thresholds = {}) {
  const cfg = { min_support_count: 2, min_share_delta: 0.2, strong_share_delta: 0.35, ...thresholds };
  const candidates = [];
  const coverage_flags = [...(diff.coverage_flags || [])];
  let n = 1;
  const push = (c) => candidates.push({ candidate_id: `candidate_${String(n++).padStart(3, "0")}`, ...c });

  const created = diff.inventory_delta?.created || [];
  const deleted = diff.inventory_delta?.deleted || [];
  if (created.length || deleted.length) {
    push({
      candidate_type: "inventory_change",
      claim_kind: "computed",
      input_claim_kinds: ["observed"],
      axis: "inventory",
      from: { deleted: deleted.length },
      to: { created: created.length },
      support_count: created.length + deleted.length,
      share_delta: 0,
      strength: created.length + deleted.length >= cfg.min_support_count ? "medium" : "weak",
      evidence_refs: [...created, ...deleted].map((a) => a.library_id || a.image_ref),
      coverage_flags: [],
    });
  }

  for (const [axis, delta] of Object.entries(diff.distribution_delta || {})) {
    const type = TYPE_BY_AXIS[axis];
    if (!type) continue;
    if (axis === "audience_read" && (delta.missing_axis || (!delta.from_count && !delta.to_count))) {
      coverage_flags.push("audience_read absent — audience/persona shift candidates suppressed");
      continue;
    }
    for (const [value, rec] of Object.entries(delta.values || {})) {
      const absDelta = Math.abs(rec.delta || 0);
      if (absDelta < cfg.min_share_delta || (rec.support_count || 0) < cfg.min_support_count) continue;
      push({
        candidate_type: type,
        claim_kind: "computed",
        input_claim_kinds: ["classified"],
        axis,
        from: rec.from,
        to: rec.to,
        support_count: rec.support_count,
        share_delta: rec.delta,
        strength: strengthFor(absDelta, delta.confidence_floor, { strongShareDelta: cfg.strong_share_delta }),
        evidence_refs: [`${diff.from_snapshot_id}`, `${diff.to_snapshot_id}`, `${axis}:${value}`],
        coverage_flags: delta.confidence_floor === "low" ? [`${axis} includes low-confidence classified reads — strength capped below strong`] : [],
      });
    }
  }
  return {
    from_snapshot_id: diff.from_snapshot_id,
    to_snapshot_id: diff.to_snapshot_id,
    candidates,
    coverage_flags,
  };
}
