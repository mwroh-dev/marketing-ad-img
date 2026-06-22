import test from "node:test";
import assert from "node:assert/strict";
import { parseAdvertiserId, filterQueriesByModes, dedupKey, chooseAdvertiser, safeName, buildCreativeRecord, classifyResponse } from "./ad-source-helpers.mjs";

test("safeName accepts a plain segment, rejects traversal/separators", () => {
  assert.equal(safeName("buyer", "personaId"), "buyer");
  assert.equal(safeName("run-2026-06-21", "runId"), "run-2026-06-21");
  for (const bad of ["../../tmp/evil", "a/b", "a\\b", "..", ".", "", "x\0y", null, undefined, 7]) {
    assert.throws(() => safeName(bad, "id"), /must be a simple name/);
  }
});

test("parseAdvertiserId extracts AR id from advertiser href, ignores query", () => {
  assert.equal(parseAdvertiserId("/advertiser/AR17828074650563772417?region=KR"), "AR17828074650563772417");
  assert.equal(parseAdvertiserId("https://adstransparency.google.com/advertiser/AR123"), "AR123");
  assert.equal(parseAdvertiserId("/region=KR"), null);
  assert.equal(parseAdvertiserId(""), null);
});

test("filterQueriesByModes keeps only accepted modes", () => {
  const qs = [{ mode: "keyword", query: "kw1" }, { mode: "advertiser", query: "BrandX" }];
  assert.deepEqual(filterQueriesByModes(qs, ["advertiser"]), [{ mode: "advertiser", query: "BrandX" }]);
  assert.deepEqual(filterQueriesByModes(qs, ["keyword", "advertiser"]), qs);
});

test("dedupKey strips query string", () => {
  assert.equal(dedupKey("https://h/img.jpg?a=1&b=2"), "https://h/img.jpg");
  assert.equal(dedupKey("https://h/img.jpg"), "https://h/img.jpg");
});

test("chooseAdvertiser prefers exact, then prefix, over substring (BrandY ≠ XBrandY)", () => {
  const sugg = [
    { text: "XBrandY\n인증\n미국\n광고 약 17개", x: 1, y: 1 },
    { text: "BrandY\n인증\n대한민국\n광고 약 6개", x: 2, y: 2 },
  ];
  const pick = chooseAdvertiser(sugg, "BrandY");
  assert.equal(pick.index, 1);              // the exact "BrandY", NOT first-listed XBrandY
  assert.equal(pick.quality, "exact");
});

test("chooseAdvertiser returns loose when only a substring match exists", () => {
  const sugg = [{ text: "XBrandY\n인증", x: 1, y: 1 }];
  const pick = chooseAdvertiser(sugg, "BrandY");
  assert.equal(pick.index, 0);
  assert.equal(pick.quality, "loose");      // caller can flag this as low-confidence
});

test("chooseAdvertiser returns null when no name relates", () => {
  assert.equal(chooseAdvertiser([{ text: "BrandZ\n인증" }], "BrandY"), null);
  assert.equal(chooseAdvertiser([], "BrandY"), null);
  assert.equal(chooseAdvertiser(null, "BrandY"), null);
});

test("chooseAdvertiser matches advertiser name ignoring spaces/case", () => {
  const pick = chooseAdvertiser([{ text: "BrandX SKY\n인증", x: 5, y: 5 }], "BrandXSKY");
  assert.equal(pick.quality, "exact");
});

test("classifyResponse prefers video then image then null, uses mime", () => {
  const a = { imgMatch: (u) => u.includes("img"), videoMatch: (u, mime) => /^video\//.test(mime) || u.includes("vid") };
  assert.equal(classifyResponse("https://x/vid.mp4", a), "video");
  assert.equal(classifyResponse("https://x/anything", a, "video/mp4"), "video");   // mime-led
  assert.equal(classifyResponse("https://x/img.jpg", a), "image");
  assert.equal(classifyResponse("https://x/other", a), null);
  assert.equal(classifyResponse("https://x/img", { imgMatch: (u) => u.includes("img") }), "image"); // no videoMatch
});

test("buildCreativeRecord shapes image and video records", () => {
  const img = buildCreativeRecord({ kind: "image", key: "https://x/i", n: 0, meta: { detail_captured: true } });
  assert.equal(img.subtype, "single_image");
  assert.equal(img.image_url, "https://x/i");
  assert.equal(img.image_file, "images/ad-0.jpg");
  assert.equal(img.detail_captured, true);

  const vid = buildCreativeRecord({ kind: "video", key: "https://x/v", n: 2, meta: {} });
  assert.equal(vid.subtype, "video");
  assert.equal(vid.video_url, "https://x/v");
  assert.equal(vid.video_file, "videos/ad-2.mp4");
  assert.equal(vid.image_url, undefined);

  const unsaved = buildCreativeRecord({ kind: "video", key: "https://x/v", n: 3, meta: {}, saved: false });
  assert.equal(unsaved.video_file, undefined);
  assert.equal(unsaved.video_url, "https://x/v");
});

test("buildCreativeRecord: image (poster) response carrying a video_url → VIDEO record (recon §10)", () => {
  // Meta video ad: the .mp4 never loads in headless, so video_url is read from the modal <video>.src DOM
  // and carried in metaByKey keyed by the POSTER jpg. The drained network response is the poster (kind=image),
  // but its merged meta has video_url → the record must become subtype:"video" with the real mp4 url,
  // keeping the poster as image_url + the saved thumbnail jpg (NO video bytes — url-only per §10c).
  const poster = "https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/poster.jpg";
  const mp4 = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/clip.mp4";
  const rec = buildCreativeRecord({ kind: "image", key: poster, n: 5, meta: { video_url: mp4, video_duration: "0:00 / 0:43", detail_captured: true, advertiser_name: "올록담" } });
  assert.equal(rec.subtype, "video");
  assert.equal(rec.video_url, mp4);            // the real mp4, not the poster key
  assert.equal(rec.image_url, poster);          // poster kept as the thumbnail
  assert.equal(rec.image_file, "images/ad-5.jpg"); // saved bytes are the poster (thumbnail), not a video file
  assert.equal(rec.video_file, undefined);      // url-only — no mp4 bytes fetched
  assert.equal(rec.video_duration, "0:00 / 0:43");
  assert.equal(rec.advertiser_name, "올록담");
  assert.equal(rec.detail_captured, true);

  // unsaved (poster bytes evicted) still yields a video record with the url, no file
  const unsaved = buildCreativeRecord({ kind: "image", key: poster, n: 6, meta: { video_url: mp4 }, saved: false });
  assert.equal(unsaved.subtype, "video");
  assert.equal(unsaved.video_url, mp4);
  assert.equal(unsaved.image_file, undefined);

  // a plain image (no video_url) stays single_image
  const plain = buildCreativeRecord({ kind: "image", key: poster, n: 7, meta: { detail_captured: true } });
  assert.equal(plain.subtype, "single_image");
  assert.equal(plain.video_url, undefined);
});
