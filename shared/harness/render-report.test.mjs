import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReport } from "./render-report.mjs";

const TEMPLATE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "competitive-report.template.html"), "utf8");
const render = (t) => renderReport(t, TEMPLATE);

test("two-snapshot trend renders longevity + advertisers + change rows", () => {
  const html = render({
    persona_id: "persona_x", snapshot_count: 2, total_creatives: 5, tracked_ads: 4,
    longevity_top_k: [{ library_id: "100", running_days: 156, advertiser_name: "adv_a", status: "active" }],
    advertisers: [{ advertiser_name: "adv_a", variation_count: 2, platform_mix: ["facebook", "instagram"] }],
    new_since_last: ["103"], disappeared_since_last: ["101"], cadence_new_ads_per_week: 0.5,
    coverage_flags: [], today: "2026-06-20", generated_at: "2026-06-22T00:00:00Z",
    synthesis: "adv_a가 156일째 최장수.",
  });
  assert.match(html, /156일/);
  assert.match(html, /adv_a/);
  assert.match(html, /103/);                 // new_since_last rendered
  assert.match(html, /주당 약 <b>0.5<\/b>종/); // cadence rendered
  assert.match(html, /adv_a가 156일째 최장수/); // synthesis rendered
});

test("single snapshot: change section says NOT-yet-observable, never fabricated rows", () => {
  const html = render({
    persona_id: "p", snapshot_count: 1, total_creatives: 2, tracked_ads: 2,
    longevity_top_k: [{ library_id: "1", running_days: 30 }],
    advertisers: [{ advertiser_name: "a", variation_count: 2 }],
    coverage_flags: ["single dated snapshot — new/disappeared/cadence require ≥2 collections over time"],
    today: "2026-06-20", generated_at: "x",
  });
  assert.match(html, /아직 관측할 수 없습니다/);   // honest degrade
  assert.doesNotMatch(html, /신규<\/b> \(직전/);   // the change rows are NOT rendered
  assert.match(html, /single dated snapshot/);     // coverage flag surfaced (provenance)
});

test("empty longevity (no started_at) renders explicit empty note, not a fake row", () => {
  const html = render({
    persona_id: "p", snapshot_count: 1, total_creatives: 1, tracked_ads: 1,
    longevity_top_k: [], advertisers: [],
    coverage_flags: ["1 tracked ad(s) lack started_at — excluded from longevity ranking"],
    generated_at: "x",
  });
  assert.match(html, /장수 순위를 산출할 수 없습니다/);
});

test("missing synthesis renders a placeholder, never invents one", () => {
  const html = render({ persona_id: "p", snapshot_count: 1, total_creatives: 0, tracked_ads: 0, longevity_top_k: [], advertisers: [], coverage_flags: [], generated_at: "x" });
  assert.match(html, /synthesis\) 이?가? 아직 작성되지 않았습니다|아직 작성되지 않았습니다/);
});

test("HTML-escapes dynamic content (no injection)", () => {
  const html = render({
    persona_id: "<script>alert(1)</script>", snapshot_count: 1, total_creatives: 0, tracked_ads: 0,
    longevity_top_k: [], advertisers: [], coverage_flags: [], generated_at: "x",
    synthesis: "<img src=x onerror=alert(2)>",
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror/);
});
