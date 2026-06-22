import test from "node:test";
import assert from "node:assert/strict";
import { toDay, daysBetween, aggregateTrend } from "./competitive-trend.mjs";

// VALUE-AGNOSTIC fixtures: library_ids (L1…), advertiser names (adv_a…), platforms (p1…) are abstract
// placeholders. The test proves the temporal/grouping LOGIC and the "no fake data" omission discipline —
// never domain content (whether an ad IS "good" is the analyst's reasoning, gated by the checklist).

test("toDay parses YYYY-MM-DD / ISO, rejects sentinels", () => {
  assert.equal(toDay("2026-06-01"), toDay("2026-06-01T12:00:00Z"));   // time part ignored
  assert.equal(toDay("dry-run"), null);
  assert.equal(toDay("live-cdp-run"), null);
  assert.equal(toDay(null), null);
  assert.equal(daysBetween("2026-06-01", "2026-06-11"), 10);
  assert.equal(daysBetween("2026-06-01", "bad"), null);   // never a fabricated 0
});

test("single dated snapshot: longevity from started_at, variation count, NO new/disappeared (omitted + flagged)", () => {
  const snap = {
    persona_id: "persona_x",
    captured_at: "2026-06-20T00:00:00Z",
    creatives: [
      { library_id: "L1", started_at: "2026-01-01", advertiser_name: "adv_a", platforms: ["p1", "p2"], status: "active" },
      { library_id: "L2", started_at: "2026-06-10", advertiser_name: "adv_a", platforms: ["p1"], status: "active" },
      { library_id: "L3", advertiser_name: "adv_b" },   // no started_at → excluded from longevity, not zero-ranked
    ],
  };
  const t = aggregateTrend({ snapshots: [snap], today: "2026-06-20" });

  assert.equal(t.snapshot_count, 1);
  assert.equal(t.dated_snapshot_count, 1);
  assert.equal(t.tracked_ads, 3);
  assert.deepEqual(t.longevity_top_k.map((a) => a.library_id), ["L1", "L2"]);   // L3 excluded (no started_at)
  assert.equal(t.longevity_top_k[0].running_days, daysBetween("2026-01-01", "2026-06-20"));
  assert.deepEqual(t.advertisers, [
    { advertiser_name: "adv_a", variation_count: 2, platform_mix: ["p1", "p2"] },
    { advertiser_name: "adv_b", variation_count: 1 },
  ]);
  // single dated snapshot ⇒ all present ads are still_present (latest == only dated day)
  assert.equal(t.ads.find((a) => a.library_id === "L1").still_present, true);
  // NO fake data: change fields ABSENT (not empty arrays) with <2 dated snapshots
  assert.equal("new_since_last" in t, false);
  assert.equal("disappeared_since_last" in t, false);
  assert.equal("cadence_new_ads_per_week" in t, false);
  assert.ok(t.coverage_flags.some((f) => /fewer than 2 dated snapshots/.test(f)));
  assert.ok(t.coverage_flags.some((f) => /lack started_at/.test(f)));
  assert.equal("running_days" in t.ads.find((a) => a.library_id === "L3"), false);
});

test("single UNDATED snapshot (pre-timestamp real data): longevity + variation survive; no still_present, no deltas", () => {
  // The mig-test scenario: real collection with captured_at "live-cdp-run". started_at is real → longevity must
  // NOT be thrown away just because the snapshot has no parseable date.
  const snap = {
    persona_id: "p-test", captured_at: "live-cdp-run",
    creatives: [
      { library_id: "100", started_at: "2025-08-31", advertiser_name: "감탄수산", platforms: ["facebook", "instagram"], status: "active", subtype: "video" },
      { library_id: "101", started_at: "2026-02-26", advertiser_name: "진시황의 비밀", platforms: ["facebook"], status: "active" },
    ],
  };
  const t = aggregateTrend({ snapshots: [snap], today: "2026-06-22" });
  assert.equal(t.snapshot_count, 1);          // counted as a snapshot
  assert.equal(t.dated_snapshot_count, 0);    // but not dated
  assert.equal(t.tracked_ads, 2);             // ads survive (NOT dropped)
  assert.equal(t.longevity_top_k[0].library_id, "100");   // real longevity from started_at
  assert.equal(t.longevity_top_k[0].running_days, daysBetween("2025-08-31", "2026-06-22"));
  assert.equal("still_present" in t.ads.find((a) => a.library_id === "100"), false);   // undatable → omitted, not faked
  assert.equal("new_since_last" in t, false);
  assert.ok(t.coverage_flags.some((f) => /non-timestamp captured_at/.test(f)));
  assert.ok(t.coverage_flags.some((f) => /fewer than 2 dated snapshots/.test(f)));
});

test("two dated snapshots: new/disappeared/cadence appear, observed_span computed, still_present tracks latest", () => {
  const s1 = { persona_id: "persona_x", captured_at: "2026-06-01", creatives: [
    { library_id: "L1", started_at: "2026-05-01", advertiser_name: "adv_a" },
    { library_id: "L2", started_at: "2026-05-20", advertiser_name: "adv_a" },
  ] };
  const s2 = { persona_id: "persona_x", captured_at: "2026-06-08", creatives: [
    { library_id: "L1", started_at: "2026-05-01", advertiser_name: "adv_a" },   // survived
    { library_id: "L3", started_at: "2026-06-05", advertiser_name: "adv_a" },   // new
  ] };
  const t = aggregateTrend({ snapshots: [s2, s1], today: "2026-06-08" });   // unordered input → sorted internally

  assert.equal(t.snapshot_count, 2);
  assert.equal(t.dated_snapshot_count, 2);
  assert.deepEqual(t.new_since_last, ["L3"]);
  assert.deepEqual(t.disappeared_since_last, ["L2"]);
  const L1 = t.ads.find((a) => a.library_id === "L1");
  assert.equal(L1.observed_span_days, 7);
  assert.equal(L1.still_present, true);
  assert.equal(t.ads.find((a) => a.library_id === "L2").still_present, false);
  assert.equal("observed_span_days" in t.ads.find((a) => a.library_id === "L3"), false);
  assert.equal(t.cadence_new_ads_per_week, 1);   // 1 new ad over a 7-day span
});

test("no-library_id creatives are excluded + flagged; dated+undated mix counts both for ads", () => {
  const dated = { persona_id: "p", captured_at: "2026-06-10", creatives: [{ library_id: "L1", started_at: "2026-06-01" }, { started_at: "2026-06-01" }] };
  const undated = { persona_id: "p", captured_at: "live-cdp-run", creatives: [{ library_id: "LX", started_at: "2026-06-01" }] };
  const t = aggregateTrend({ snapshots: [dated, undated], today: "2026-06-10" });
  assert.equal(t.snapshot_count, 2);
  assert.equal(t.dated_snapshot_count, 1);
  assert.equal(t.tracked_ads, 2);   // L1 (dated) + LX (undated); the id-less creative excluded
  assert.ok(t.coverage_flags.some((f) => /non-timestamp captured_at/.test(f)));
  assert.ok(t.coverage_flags.some((f) => /lack library_id/.test(f)));
});

test("deterministic: same input → identical output", () => {
  const snaps = [
    { persona_id: "p", captured_at: "2026-06-01", creatives: [{ library_id: "L1", started_at: "2026-05-01", advertiser_name: "a" }] },
    { persona_id: "p", captured_at: "2026-06-08", creatives: [{ library_id: "L2", started_at: "2026-06-02", advertiser_name: "a" }] },
  ];
  assert.deepEqual(aggregateTrend({ snapshots: snaps, today: "2026-06-08" }), aggregateTrend({ snapshots: snaps, today: "2026-06-08" }));
});
