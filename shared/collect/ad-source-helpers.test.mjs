import test from "node:test";
import assert from "node:assert/strict";
import { parseAdvertiserId, filterQueriesByModes, dedupKey, fbcdnAssetId, chooseAdvertiser, safeName, buildCreativeRecord, classifyResponse, downloadVideoFile, downloadImageFile, isImageMagic } from "./ad-source-helpers.mjs";

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

test("fbcdnAssetId: same id across two different-SIZE/path variants of one asset; null when no _n basename", () => {
  // The live gap: fbcdn serves one asset under different host/path/size variants → different dedupKeys.
  // The `_n.(jpg|mp4)` basename is the stable, size-invariant identity → both variants share one asset id.
  const v1 = "https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/643399974_1422859576201451_1855107910192996339_n.jpg?stp=dst-jpg_s600x600&_nc_cat=1&oh=A&oe=B";
  const v2 = "https://scontent-a.xx.fbcdn.net/v/t39.35426-6/643399974_1422859576201451_1855107910192996339_n.jpg?stp=dst-jpg_p1080x1080&_nc_cat=9&oh=C&oe=D";
  const id = "643399974_1422859576201451_1855107910192996339";
  assert.equal(fbcdnAssetId(v1), id);
  assert.equal(fbcdnAssetId(v2), id, "size/host variants of the same asset must yield the SAME asset id");
  assert.equal(fbcdnAssetId(v1), fbcdnAssetId(v2));

  // mp4 basename also supported (poster→video asset stems)
  assert.equal(fbcdnAssetId("https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/100_200_300_n.mp4?oh=x"), "100_200_300");
  // single-leading-number forms still parse (≥1 underscore-joined number + _n)
  assert.equal(fbcdnAssetId("https://x.fbcdn.net/v/t39.35426-6/12345_67890_n.jpg"), "12345_67890");

  // null cases: no _n basename / non-conforming / non-string
  assert.equal(fbcdnAssetId("https://x.fbcdn.net/v/t39.35426-6/poster.jpg"), null);
  assert.equal(fbcdnAssetId("https://x.fbcdn.net/v/t39.35426-6/643399974_1422859576201451_o.jpg"), null, "_o (not _n) is not an ad asset basename");
  assert.equal(fbcdnAssetId("https://adstransparency.google.com/creative/abc.png"), null);
  assert.equal(fbcdnAssetId(""), null);
  assert.equal(fbcdnAssetId(null), null);
  assert.equal(fbcdnAssetId(undefined), null);
  assert.equal(fbcdnAssetId(12345), null);
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

test("buildCreativeRecord: videoSaved attaches video_file; transient video_url_full is never persisted (recon §11)", () => {
  const poster = "https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/poster.jpg";
  const mp4 = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/clip.mp4";
  const full = mp4 + "?_nc_cat=1&oh=sig&oe=exp";
  // video file was downloaded → video_file points at videos/ad-N.mp4, and the signed url is stripped out.
  const saved = buildCreativeRecord({ kind: "image", key: poster, n: 5, meta: { video_url: mp4, video_url_full: full, detail_captured: true }, videoSaved: true });
  assert.equal(saved.subtype, "video");
  assert.equal(saved.video_url, mp4);
  assert.equal(saved.video_file, "videos/ad-5.mp4");      // the actual mp4 bytes
  assert.equal(saved.image_file, "images/ad-5.jpg");      // poster thumbnail still saved
  assert.equal(saved.video_url_full, undefined, "the signed (expiring) url must NOT be persisted");

  // download failed (videoSaved false) → url-only, no video_file, still no signed url leak.
  const urlOnly = buildCreativeRecord({ kind: "image", key: poster, n: 6, meta: { video_url: mp4, video_url_full: full }, videoSaved: false });
  assert.equal(urlOnly.subtype, "video");
  assert.equal(urlOnly.video_url, mp4);
  assert.equal(urlOnly.video_file, undefined);
  assert.equal(urlOnly.video_url_full, undefined);

  // kind:"video" (buffered .mp4 response) also strips the transient signed url.
  const buffered = buildCreativeRecord({ kind: "video", key: mp4, n: 2, meta: { video_url_full: full, detail_captured: true } });
  assert.equal(buffered.video_url, mp4);
  assert.equal(buffered.video_file, "videos/ad-2.mp4");
  assert.equal(buffered.video_url_full, undefined);
});

test("downloadVideoFile: writes a valid non-trivial mp4, rejects 403 / short / non-mp4 (no fabrication)", async () => {
  const FTYP = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom", "ascii")]);
  const bigMp4 = Buffer.concat([FTYP, Buffer.alloc(60 * 1024)]); // > 50KB, valid ftyp magic
  const mkRes = (ok, status, body) => ({ ok, status, arrayBuffer: async () => body });

  // success: valid mp4 → saved, bytes reported, writer called with the buffer.
  let written = null;
  const ok = await downloadVideoFile("https://x/clip.mp4?oh=sig", "/tmp/v.mp4", {
    fetchFn: async () => mkRes(true, 200, bigMp4),
    writeFile: (p, b) => { written = { p, len: b.length }; },
  });
  assert.equal(ok.saved, true);
  assert.equal(ok.bytes, bigMp4.length);
  assert.deepEqual(written, { p: "/tmp/v.mp4", len: bigMp4.length });

  // 403 (stripped/expired url) → not saved, no write, honest reason.
  let w403 = false;
  const r403 = await downloadVideoFile("https://x/clip.mp4", "/tmp/v.mp4", { fetchFn: async () => mkRes(false, 403, Buffer.alloc(0)), writeFile: () => { w403 = true; } });
  assert.equal(r403.saved, false);
  assert.match(r403.reason, /403/);
  assert.equal(w403, false, "must not write on failure (no fabricated file)");

  // 200 but tiny / not an mp4 → rejected (error page, not a video).
  const tiny = await downloadVideoFile("https://x/clip.mp4", "/tmp/v.mp4", { fetchFn: async () => mkRes(true, 200, Buffer.from("<html>nope</html>")), writeFile: () => { throw new Error("should not write"); } });
  assert.equal(tiny.saved, false);
  assert.match(tiny.reason, /invalid mp4/);

  // network throw → not saved, reason carried.
  const err = await downloadVideoFile("https://x/clip.mp4", "/tmp/v.mp4", { fetchFn: async () => { throw new Error("ECONNRESET"); }, writeFile: () => {} });
  assert.equal(err.saved, false);
  assert.match(err.reason, /ECONNRESET/);

  // no url → not saved.
  const none = await downloadVideoFile(null, "/tmp/v.mp4", {});
  assert.equal(none.saved, false);
});

test("downloadVideoFile: bounded — aborts a hung fetch (timeout) and rejects oversized bodies (no budget/memory blowup)", async () => {
  // hung CDN: fetch never resolves until the AbortController signal fires → timeout reason, no write.
  let hungWrote = false;
  const hung = await downloadVideoFile("https://x/clip.mp4?oh=sig", "/tmp/v.mp4", {
    timeoutMs: 5,
    fetchFn: (url, { signal }) => new Promise((_, rej) => {
      signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); });
    }),
    writeFile: () => { hungWrote = true; },
  });
  assert.equal(hung.saved, false);
  assert.match(hung.reason, /timeout/);
  assert.equal(hungWrote, false, "must not write a file from a timed-out fetch");

  // oversized: Content-Length above maxBytes → rejected before buffering, no write.
  const mkResH = (cl) => ({ ok: true, status: 200, headers: { get: () => String(cl) }, arrayBuffer: async () => Buffer.alloc(0) });
  const big = await downloadVideoFile("https://x/clip.mp4", "/tmp/v.mp4", {
    maxBytes: 50 * 1024 * 1024,
    fetchFn: async () => mkResH(200 * 1024 * 1024),  // 200MB
    writeFile: () => { throw new Error("should not write an oversized body"); },
  });
  assert.equal(big.saved, false);
  assert.match(big.reason, /too large/);
});

test("isImageMagic recognizes JPEG/PNG/WEBP/GIF, rejects html/short", () => {
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(12)]);
  const webp = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii")]);
  const gif = Buffer.concat([Buffer.from("GIF8", "ascii"), Buffer.alloc(12)]);
  assert.equal(isImageMagic(jpg), true);
  assert.equal(isImageMagic(png), true);
  assert.equal(isImageMagic(webp), true);
  assert.equal(isImageMagic(gif), true);
  assert.equal(isImageMagic(Buffer.from("<html>nope</html>")), false);
  assert.equal(isImageMagic(Buffer.alloc(4)), false);  // too short
});

test("downloadImageFile: writes a valid non-trivial jpg, rejects 403 / tiny / non-image (no fabrication, recon §12)", async () => {
  const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(30 * 1024)]); // > 2KB floor, JPEG magic
  const mkRes = (ok, status, body) => ({ ok, status, headers: { get: () => null }, arrayBuffer: async () => body });

  // success: valid jpg → saved, bytes reported, writer called.
  let written = null;
  const ok = await downloadImageFile("https://scontent/x_n.jpg?oh=sig", "/tmp/i.jpg", {
    fetchFn: async () => mkRes(true, 200, JPG),
    writeFile: (p, b) => { written = { p, len: b.length }; },
  });
  assert.equal(ok.saved, true);
  assert.equal(ok.bytes, JPG.length);
  assert.deepEqual(written, { p: "/tmp/i.jpg", len: JPG.length });

  // 403 (expired/stripped signature) → not saved, no write.
  let w403 = false;
  const r403 = await downloadImageFile("https://scontent/x_n.jpg", "/tmp/i.jpg", { fetchFn: async () => mkRes(false, 403, Buffer.alloc(0)), writeFile: () => { w403 = true; } });
  assert.equal(r403.saved, false);
  assert.match(r403.reason, /403/);
  assert.equal(w403, false);

  // tiny (page-chrome icon) → rejected by the size floor.
  const tiny = await downloadImageFile("https://scontent/icon_n.jpg", "/tmp/i.jpg", {
    fetchFn: async () => mkRes(true, 200, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(500)])),
    writeFile: () => { throw new Error("should not write a tiny icon"); },
  });
  assert.equal(tiny.saved, false);
  assert.match(tiny.reason, /too small/);

  // 200 but not an image (error page big enough to pass the floor) → rejected by magic check.
  const notImg = await downloadImageFile("https://scontent/x_n.jpg", "/tmp/i.jpg", {
    fetchFn: async () => mkRes(true, 200, Buffer.from("<html>" + "x".repeat(5000) + "</html>")),
    writeFile: () => { throw new Error("should not write a non-image"); },
  });
  assert.equal(notImg.saved, false);
  assert.match(notImg.reason, /not an image/);

  // no url → not saved.
  const none = await downloadImageFile(null, "/tmp/i.jpg", {});
  assert.equal(none.saved, false);
});

test("downloadImageFile: bounded — aborts a hung fetch (timeout), rejects oversized (no budget/memory blowup)", async () => {
  let hungWrote = false;
  const hung = await downloadImageFile("https://scontent/x_n.jpg?oh=sig", "/tmp/i.jpg", {
    timeoutMs: 5,
    fetchFn: (url, { signal }) => new Promise((_, rej) => {
      signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); });
    }),
    writeFile: () => { hungWrote = true; },
  });
  assert.equal(hung.saved, false);
  assert.match(hung.reason, /timeout/);
  assert.equal(hungWrote, false);

  const big = await downloadImageFile("https://scontent/x_n.jpg", "/tmp/i.jpg", {
    maxBytes: 25 * 1024 * 1024,
    fetchFn: async () => ({ ok: true, status: 200, headers: { get: () => String(100 * 1024 * 1024) }, arrayBuffer: async () => Buffer.alloc(0) }),
    writeFile: () => { throw new Error("should not write an oversized body"); },
  });
  assert.equal(big.saved, false);
  assert.match(big.reason, /too large/);
});
