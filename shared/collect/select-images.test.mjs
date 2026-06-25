import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderSelectHtml, buildScreenJson, moveUnselected, imageCreatives, metaLine, groupByKeywordSignature, sortByStartedAt, keywordSet } from "./select-images.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(resolve(HERE, "select-grid.template.html"), "utf8");

const CREATIVES = [
  { image_file: "images/ad-0.jpg", advertiser_name: "진시황의 비밀", started_at: "2026-02-26" },
  { image_file: "images/ad-1.jpg" },
  { image_file: "videos/ad-2.mp4", video_duration: "0:43" }, // video → excluded from grid
];

test("renderSelectHtml renders one card per IMAGE creative (videos excluded) + escapes captions", () => {
  const html = renderSelectHtml(
    { runId: "r1", personaId: "p1", track: "competitor", queries: [{ query: "비타민" }], creatives: CREATIVES },
    TEMPLATE,
  );
  const cards = html.match(/class="card"/g) || [];
  assert.equal(cards.length, 2);                         // 2 images, video skipped
  assert.match(html, /data-file="images\/ad-0\.jpg"/);
  assert.match(html, /진시황의 비밀/);                    // caption shown
  assert.doesNotMatch(html, /ad-2\.mp4/);                // video not in grid
  assert.match(html, /총 2개/);                          // TOTAL token filled
  assert.match(html, /경쟁사 광고/);                      // track label
  assert.match(html, /비타민/);                          // query in meta
});

test("renderSelectHtml empty-states when there are no images (no fabricated card)", () => {
  const html = renderSelectHtml({ runId: "r", personaId: "p", creatives: [{ image_file: "videos/x.mp4" }] }, TEMPLATE);
  assert.match(html, /표시할 이미지가 없습니다/);
  assert.doesNotMatch(html, /class="card"/);
  assert.match(html, /총 0개/);
});

test("metaLine degrades gracefully with no queries / unknown track", () => {
  assert.match(metaLine({ runId: "r", personaId: "p", track: undefined, queries: [] }), /검색어 정보 없음/);
  assert.match(metaLine({ runId: "r", personaId: "p", track: "category_keyword", queries: [{ query: "x" }] }), /카테고리\/키워드 광고/);
});

test("imageCreatives keeps only image-extension files", () => {
  assert.deepEqual(imageCreatives(CREATIVES).map((c) => c.image_file), ["images/ad-0.jpg", "images/ad-1.jpg"]);
  assert.deepEqual(imageCreatives(null), []);
});

test("buildScreenJson: kept + dropped(user_removed) account for every image, total invariant holds", () => {
  const all = ["images/ad-0.jpg", "images/ad-1.jpg", "images/ad-2.jpg"];
  const j = buildScreenJson("r1", "p1", all, ["images/ad-0.jpg", "images/ad-2.jpg"]);
  assert.equal(j.run_id, "r1");
  assert.equal(j.persona_id, "p1");
  assert.deepEqual(j.kept, ["images/ad-0.jpg", "images/ad-2.jpg"]);
  assert.deepEqual(j.dropped, [{ image_file: "images/ad-1.jpg", reason: "user_removed" }]);
  assert.equal(j.total, j.kept.length + j.dropped.length);   // schema invariant: nothing dropped silently
  assert.equal(j.total, 3);
});

test("buildScreenJson matches by basename (page may send full paths or bare names)", () => {
  const j = buildScreenJson("r", "p", ["images/ad-0.jpg", "images/ad-1.jpg"], ["ad-1.jpg"]);
  assert.deepEqual(j.kept, ["images/ad-1.jpg"]);
  assert.equal(j.dropped.length, 1);
});

test("buildScreenJson: empty selection drops everything (none silently kept)", () => {
  const j = buildScreenJson("r", "p", ["images/ad-0.jpg"], []);
  assert.equal(j.kept.length, 0);
  assert.equal(j.dropped.length, 1);
  assert.equal(j.total, 1);
});

test("moveUnselected relocates only the non-kept images to _removed/, kept stays put", () => {
  const tmp = resolve(HERE, "__test_imgs__");
  try {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    for (const f of ["ad-0.jpg", "ad-1.jpg", "ad-2.png"]) writeFileSync(resolve(tmp, f), "x");

    const moved = moveUnselected(tmp, ["images/ad-0.jpg"]);    // keep ad-0 only
    assert.deepEqual(moved.sort(), ["ad-1.jpg", "ad-2.png"]);
    assert.ok(existsSync(resolve(tmp, "ad-0.jpg")));            // kept in place
    assert.ok(!existsSync(resolve(tmp, "ad-1.jpg")));           // moved out
    assert.ok(existsSync(resolve(tmp, "_removed", "ad-1.jpg")));
    assert.ok(existsSync(resolve(tmp, "_removed", "ad-2.png")));
    assert.deepEqual(readdirSync(tmp).filter((f) => /\.(jpe?g|png)$/i.test(f)), ["ad-0.jpg"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });   // guaranteed cleanup even if an assertion throws
  }
});

test("moveUnselected on a missing dir is a no-op (returns [])", () => {
  assert.deepEqual(moveUnselected(resolve(HERE, "__nope__"), []), []);
});

// ---- model-B keyword grouping ------------------------------------------------------------------------------

const img = (file, keywords, started_at) => ({ image_file: file, ...(keywords ? { keywords } : {}), ...(started_at ? { started_at } : {}) });

test("keywordSet dedupes, trims and sorts; missing → []", () => {
  assert.deepEqual(keywordSet({ keywords: ["b", "a", "a", " b ", ""] }), ["a", "b"]);
  assert.deepEqual(keywordSet({}), []);
  assert.deepEqual(keywordSet(null), []);
});

test("groupByKeywordSignature: exact-combo sections, count desc then label asc, 미분류 last", () => {
  // user's example: singles {a},{b},{c} + combos {a,b},{a,b,c} → abc / ab / a / b / c  (+ an unkeyed ad last)
  const creatives = [
    img("images/0.jpg", ["a"]), img("images/1.jpg", ["b"]), img("images/2.jpg", ["c"]),
    img("images/3.jpg", ["a", "b"]), img("images/4.jpg", ["c", "b", "a"]),
    img("images/5.jpg", null), // no keywords → 미분류
  ];
  const groups = groupByKeywordSignature(creatives);
  assert.deepEqual(groups.map((g) => g.label), ["a · b · c", "a · b", "a", "b", "c", "미분류"]);
  assert.deepEqual(groups.map((g) => g.items.length), [1, 1, 1, 1, 1, 1]);
});

test("groupByKeywordSignature: one ad in multiple keywords lands in its EXACT combo once (no duplication)", () => {
  const creatives = [
    img("images/0.jpg", ["a", "b", "c"]), img("images/1.jpg", ["a", "b"]),
    img("images/2.jpg", ["a", "b"]), img("images/3.jpg", ["a", "b", "c"]),
  ];
  const groups = groupByKeywordSignature(creatives);
  assert.deepEqual(groups.map((g) => g.label), ["a · b · c", "a · b"]);
  assert.deepEqual(groups.map((g) => g.items.map((c) => c.image_file)), [["images/0.jpg", "images/3.jpg"], ["images/1.jpg", "images/2.jpg"]]);
});

test("sortByStartedAt: oldest first (ISO lexical), undated sinks to the end, stable", () => {
  const items = [
    { image_file: "x", started_at: "2026-02-26" }, { image_file: "y" },
    { image_file: "z", started_at: "2024-01-01" }, { image_file: "w", started_at: "2025-06-15" },
  ];
  assert.deepEqual(sortByStartedAt(items).map((c) => c.image_file), ["z", "w", "x", "y"]);
});

test("renderSelectHtml: section header + oldest-first within section + ad_copy shown", () => {
  const creatives = [
    img("images/new.jpg", ["수분크림"], "2026-02-01"),
    { image_file: "images/old.jpg", keywords: ["수분크림"], started_at: "2024-03-10", ad_copy: "촉촉한 보습" },
  ];
  const html = renderSelectHtml({ runId: "r", personaId: "p", queries: [{ query: "수분크림" }], creatives }, TEMPLATE);
  assert.match(html, /키워드: 수분크림/);                          // section header rendered
  assert.match(html, /class="kw-count">2</);                       // count badge
  assert.match(html, /촉촉한 보습/);                                // ad_copy line shown
  assert.match(html, /총 2개/);
  // oldest (2024) card must appear before the newer (2026) card in document order
  assert.ok(html.indexOf("images/old.jpg") < html.indexOf("images/new.jpg"));
});

test("renderSelectHtml: older run with no keywords → single 미분류 group renders bare grid (no header)", () => {
  const html = renderSelectHtml({ runId: "r", personaId: "p", creatives: [{ image_file: "images/a.jpg" }] }, TEMPLATE);
  assert.doesNotMatch(html, /<h1 class="kw-h1">/);   // no rendered section header when only 미분류 exists (CSS .kw-h1 stays)
  assert.match(html, /class="card"/);
  assert.match(html, /총 1개/);
});
