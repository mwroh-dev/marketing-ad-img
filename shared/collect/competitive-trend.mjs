// Pure, deterministic competitive-trend aggregation across dated collection snapshots. No LLM, no network.
// Mirrors ad-pattern-rank.mjs: small value-agnostic helpers + one aggregate entry.
//
// The "no fake data" discipline is LOAD-BEARING here. Every temporal field is OMITTED — never null/0-filled —
// when the collected data cannot support it, and every such gap is surfaced as a coverage_flag (never
// silent). Cf. knowledge/guidelines/completion-verification-policy.md (gaps → coverage_flags) and the
// pattern-synthesizer "never backfill" rule. Concretely:
//   - longevity (running_days = today − started_at) is the ONE signal that works from a SINGLE snapshot; ads
//     without started_at are excluded from the ranking, not zero-ranked.
//   - new/disappeared/cadence need ≥2 dated snapshots; with one snapshot those fields are absent (omitted),
//     plus a flag — they are NOT emitted as empty arrays.
//   - creatives without library_id can't be tracked across time → counted + flagged, never given a fake id.

const DAY_MS = 86400000;

// "YYYY-MM-DD" / ISO-8601 → epoch-day integer (UTC). Returns null for anything unparseable — the dry-run /
// "live-cdp-run" sentinels, empty, malformed. Callers EXCLUDE null-day snapshots; they never guess a date.
export function toDay(s) {
  if (s == null) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
}

// Whole-day delta between two date strings; null if either is unparseable (never a fabricated 0).
export function daysBetween(fromIso, toIso) {
  const a = toDay(fromIso), b = toDay(toIso);
  if (a == null || b == null) return null;
  return b - a;
}

// Aggregate N collection snapshots (parsed ad-creative.json manifests) for ONE persona into a competitive
// trend. `today` (ISO date/datetime) is injected so running_days is deterministic + testable. Value-agnostic:
// it only orders by date, groups by library_id / advertiser_name, counts, and diffs — it judges no content.
export function aggregateTrend({ snapshots = [], today } = {}, k = 10) {
  const personaId = snapshots.find((s) => s && s.persona_id)?.persona_id ?? null;
  const flags = [];

  // 1. classify snapshots. BOTH dated and undated contribute ads to longevity + variation (those need only
  //    started_at, NOT captured_at); ONLY dated snapshots drive change-over-time (ordering, first/last_seen,
  //    new/disappeared, cadence). A "live-cdp-run"/sentinel captured_at (e.g. data collected before the
  //    timestamp field existed) is real collection — its ads' started_at is real — so we must NOT throw its
  //    longevity away; we only exclude it from temporal ordering. dry-run's example creative self-excludes
  //    below via the no-library_id rule, so no sentinel-string special-case is needed.
  const all = snapshots.map((s) => ({ day: toDay(s && s.captured_at), creatives: (s && s.creatives) || [] }));
  const dated = all.filter((s) => s.day != null).sort((a, b) => a.day - b.day);
  const undated = all.length - dated.length;
  if (undated) flags.push(`${undated} snapshot(s) had a non-timestamp captured_at — counted for longevity/variation but excluded from change-over-time (ordering, new/disappeared, cadence)`);

  const total_creatives = all.reduce((n, s) => n + s.creatives.length, 0);
  const latestDay = dated.length ? dated[dated.length - 1].day : null;

  // 2. accumulate per ad, keyed by library_id (Meta's stable ad id). No id → counted + flagged, never faked.
  //    Iterate undated FIRST, then dated ascending, so a per-ad `status` last-write reflects the most recent
  //    DATED observation when available. started_at/advertiser_name are fixed per ad ⇒ first-non-null is stable
  //    regardless of order. Only DATED appearances feed `datedDays` (the temporal basis).
  const acc = new Map();
  let noId = 0;
  for (const snap of [...all.filter((s) => s.day == null), ...dated]) {
    for (const c of snap.creatives) {
      const id = c && typeof c.library_id === "string" && c.library_id ? c.library_id : null;
      if (!id) { noId++; continue; }
      let a = acc.get(id);
      if (!a) { a = { library_id: id, datedDays: [] }; acc.set(id, a); }
      if (snap.day != null) a.datedDays.push(snap.day);
      if (a.started_at == null && c.started_at) a.started_at = c.started_at;
      if (a.advertiser_name == null && c.advertiser_name) a.advertiser_name = c.advertiser_name;
      if (a.page_id == null && c.page_id) a.page_id = c.page_id;
      if (Array.isArray(c.platforms) && c.platforms.length) a.platforms = [...new Set([...(a.platforms || []), ...c.platforms])];
      if (c.subtype) a.subtype = c.subtype;
      if (c.status) a.status = c.status;
    }
  }
  if (noId) flags.push(`${noId} creative(s) lack library_id — excluded from cross-time ad tracking`);

  // 3. finalize each ad. running_days = today − started_at (the longevity / "검증된 광고" proxy; date-independent,
  //    works from a SINGLE snapshot — even an undated one). Temporal fields (still_present, observed_span_days)
  //    are set ONLY when the ad was seen in ≥1 / ≥2 DATED snapshots — omitted (never faked) otherwise.
  const adRecs = [];
  for (const a of acc.values()) {
    const rec = { library_id: a.library_id, _firstDay: a.datedDays.length ? Math.min(...a.datedDays) : null };
    if (a.advertiser_name) rec.advertiser_name = a.advertiser_name;
    if (a.started_at) rec.started_at = a.started_at;
    const running = a.started_at != null ? daysBetween(a.started_at, today) : null;
    if (running != null && running >= 0) rec.running_days = running;   // negative ⇒ bad data → omit, don't fake
    if (a.platforms && a.platforms.length) rec.platforms = a.platforms;
    if (a.subtype) rec.subtype = a.subtype;
    if (a.status) rec.status = a.status;
    if (a.datedDays.length) rec.still_present = Math.max(...a.datedDays) === latestDay;   // only when datable
    if (new Set(a.datedDays).size >= 2) rec.observed_span_days = Math.max(...a.datedDays) - Math.min(...a.datedDays);
    adRecs.push(rec);
  }

  // 4. longevity ranking — ads WITH running_days, descending (장수 광고 = 검증된 광고 프록시). Ads lacking
  //    started_at are excluded (not zero-ranked) + flagged.
  const withRunning = adRecs.filter((a) => typeof a.running_days === "number");
  const longevity_top_k = withRunning
    .slice()
    .sort((a, b) => b.running_days - a.running_days || (a.library_id < b.library_id ? -1 : 1))
    .slice(0, k)
    .map((a) => ({
      library_id: a.library_id,
      running_days: a.running_days,
      ...(a.advertiser_name ? { advertiser_name: a.advertiser_name } : {}),
      ...(a.status ? { status: a.status } : {}),
    }));
  const missingStart = adRecs.length - withRunning.length;
  if (missingStart > 0) flags.push(`${missingStart} tracked ad(s) lack started_at — excluded from longevity ranking`);

  // 5. per-advertiser variation: distinct ads (available from ONE snapshot — "얼마나 많이 찍어내나") + platform mix.
  const advMap = new Map();
  for (const a of adRecs) {
    if (!a.advertiser_name) continue;
    let v = advMap.get(a.advertiser_name);
    if (!v) { v = { advertiser_name: a.advertiser_name, ids: new Set(), plat: new Set() }; advMap.set(a.advertiser_name, v); }
    v.ids.add(a.library_id);
    for (const p of a.platforms || []) v.plat.add(p);
  }
  const advertisers = [...advMap.values()]
    .map((v) => ({ advertiser_name: v.advertiser_name, variation_count: v.ids.size, ...(v.plat.size ? { platform_mix: [...v.plat] } : {}) }))
    .sort((a, b) => b.variation_count - a.variation_count || (a.advertiser_name < b.advertiser_name ? -1 : 1));
  const unattributed = adRecs.filter((a) => !a.advertiser_name).length;
  if (unattributed > 0) flags.push(`${unattributed} tracked ad(s) have no advertiser_name — excluded from per-advertiser variation counts`);

  const out = {
    persona_id: personaId,
    snapshot_count: all.length,            // total snapshots aggregated (dated + undated)
    dated_snapshot_count: dated.length,    // the subset with a parseable captured_at — the change-over-time basis
    total_creatives,
    tracked_ads: adRecs.length,
    ads: adRecs.map(({ _firstDay, ...r }) => r),
    longevity_top_k,
    advertisers,
    coverage_flags: flags,
    today: today ?? null,
  };

  // 6. cross-snapshot deltas — ONLY with ≥2 DATED snapshots. With <2 these fields are ABSENT (no empty-array
  //    placeholder) + a flag. This is the data-honest degrade: a single (or undated) collection reports
  //    longevity + variation only; change-over-time needs a real dated series.
  if (dated.length >= 2) {
    const prev = dated[dated.length - 2], last = dated[dated.length - 1];
    const idSet = (snap) => new Set(snap.creatives.map((c) => c && c.library_id).filter(Boolean));
    const prevIds = idSet(prev), lastIds = idSet(last);
    out.new_since_last = [...lastIds].filter((id) => !prevIds.has(id)).sort();
    out.disappeared_since_last = [...prevIds].filter((id) => !lastIds.has(id)).sort();
    const spanDays = last.day - dated[0].day;
    if (spanDays > 0) {
      const newDuringWindow = adRecs.filter((a) => a._firstDay != null && a._firstDay > dated[0].day).length;
      out.cadence_new_ads_per_week = Math.round((newDuringWindow / spanDays) * 7 * 100) / 100;
    }
  } else {
    flags.push(`fewer than 2 dated snapshots (have ${dated.length}) — new/disappeared/cadence require ≥2 dated collections over time`);
  }

  return out;
}
