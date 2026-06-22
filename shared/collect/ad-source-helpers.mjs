// Pure, platform-agnostic helpers shared by ad-source adapters + the collection harness.

// Guard against path traversal: runId/personaId/source flow straight into filesystem paths
// under .generate-ads-img/. A value like "../../tmp/evil" would escape the state sandbox and
// let mkdirSync/writeFileSync touch arbitrary locations. Reject anything that is not a single
// path segment (no separators, no "." / ".." , no NUL).
export function safeName(id, label = "name") {
  if (id == null || typeof id !== "string" || id === "" || id === "." || id === ".." || /[\/\\\0]/.test(id)) {
    throw new Error(`${label} must be a simple name (no path separators, not '.'/'..'): ${JSON.stringify(id)}`);
  }
  return id;
}

export function parseAdvertiserId(href) {
  if (!href) return null;
  const m = String(href).match(/\/advertiser\/(AR\w+)/);
  return m ? m[1] : null;
}

export function filterQueriesByModes(queries, acceptModes) {
  const set = new Set(acceptModes || []);
  return (queries || []).filter((q) => set.has(q.mode));
}

export function dedupKey(url) {
  return String(url).split("?")[0];
}

// SECONDARY join identity for fbcdn assets (additive — never replaces dedupKey). fbcdn serves the SAME
// underlying asset under different path-prefix / size-param variants, so two URLs that point at one media
// item can have different query-stripped dedupKeys (live: 3 single_image creatives whose buffered NETWORK
// url did not equal any card <img>.src key the detail was stored under). The fbcdn filename is the stable,
// size-invariant identity: `.../<a>_<BIGNUM>_<c>_n.jpg` (or `_n.mp4`). The three numbers form fbcdn's
// globally-unique media id; the basename does NOT change across size variants (size lives in the query,
// e.g. `stp=dst-jpg_s600x600`). We key on the FULL `_<a>_<b>_<c>_n` basename (not just the middle number)
// so the id is maximally specific — collision-safe by construction: two genuinely different assets cannot
// share a full basename. Returns null when the url has no fbcdn `_n.(jpg|mp4)` basename (e.g. a google
// creative or a non-conforming url) → callers simply skip the asset-id path for it.
export function fbcdnAssetId(url) {
  if (!url || typeof url !== "string") return null;
  const path = url.split("?")[0];                 // drop size/query params — basename is size-invariant
  const base = path.split("/").pop() || "";       // the filename
  // fbcdn ad-asset filename: one-or-more underscore-separated big numbers, ending in `_n.(jpg|mp4)`.
  const m = base.match(/^((?:\d+_)+\d+)_n\.(?:jpg|mp4|png|webp)$/i);
  return m ? m[1] : null;                          // the stable numeric stem (no `_n`, no extension)
}

// Pick the best advertiser suggestion for a query, avoiding wrong substring matches
// (e.g. a short brand name must NOT silently resolve to a longer name that contains it as a substring). suggestions: [{text, x, y, ...}]
// where text is the suggestion item's innerText (first line = advertiser name).
// Returns { index, name, quality } with quality "exact" | "prefix" | "loose", or null if
// no suggestion's name relates to the query at all. The caller decides whether to accept a
// "loose" (substring-only) match and how to label resolved_via.
export function chooseAdvertiser(suggestions, query) {
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const q = norm(query);
  if (!q || !Array.isArray(suggestions)) return null;
  let best = null;
  suggestions.forEach((s, i) => {
    const name = norm(String(s.text || "").split("\n")[0]);
    if (!name) return;
    let quality = null;
    if (name === q) quality = "exact";
    else if (name.startsWith(q) || q.startsWith(name)) quality = "prefix";
    else if (name.includes(q) || q.includes(name)) quality = "loose";
    if (!quality) return;
    const rank = { exact: 3, prefix: 2, loose: 1 }[quality];
    if (!best || rank > best.rank) best = { index: i, name: String(s.text || "").split("\n")[0].trim(), quality, rank };
  });
  if (!best) return null;
  const { rank, ...rest } = best;
  return rest;
}

// Classify a network response for an adapter: video takes precedence over image.
// mime is passed through (Meta videos are reliably mime=video/mp4; URL alone is a weaker signal).
export function classifyResponse(url, adapter, mime = "") {
  if (adapter && typeof adapter.videoMatch === "function" && adapter.videoMatch(url, mime)) return "video";
  if (adapter && typeof adapter.imgMatch === "function" && adapter.imgMatch(url)) return "image";
  return null;
}

// Build one creative record. `meta` carries detail-modal fields merged from normalizeDetail.
//
// Three cases:
//  - kind "video": the join key IS the mp4 url (a buffered .mp4 network response). video_url = key.
//  - kind "image" whose merged meta carries a `video_url` (Meta video ad: the .mp4 never loads in
//    background headless, so the URL is read from the modal <video>.src DOM and carried in metaByKey;
//    `key` here is the POSTER jpg = the grid card's dedup-key). → a VIDEO record: subtype "video" +
//    the modal's real video_url, with the poster kept as the thumbnail (image_url + saved jpg).
//  - kind "image" without video_url: a plain single_image creative.
//
// `videoSaved` (Meta video-via-poster path): when the harness has downloaded the actual .mp4 bytes (recon
// §11 — direct fetch of the signed url) and written `videos/ad-N.mp4`, pass videoSaved:true to attach
// `video_file`. The transient signed url (`video_url_full`) is NEVER persisted — it expires (recon §11b).
export function buildCreativeRecord({ kind, key, n, meta = {}, saved = true, videoSaved = false }) {
  if (kind === "video") {
    const { video_url_full, ...m } = meta;  // signed url is transient — never persisted
    const rec = { video_url: key, subtype: "video", ...m };
    if (saved) rec.video_file = `videos/ad-${n}.mp4`;
    return rec;
  }
  const { video_url, video_url_full, ...restMeta } = meta;  // drop the transient signed url
  if (video_url) {
    // image (poster) response, but the detail modal revealed the ad is a video → video record.
    // The poster bytes are the thumbnail → image_url/image_file; video_url carries the real mp4. When the
    // .mp4 itself was fetched (videoSaved), video_file points at the saved videos/ad-N.mp4 (recon §11).
    const rec = { video_url, subtype: "video", image_url: key, ...restMeta };
    if (saved) rec.image_file = `images/ad-${n}.jpg`;  // the thumbnail bytes (poster)
    if (videoSaved) rec.video_file = `videos/ad-${n}.mp4`;  // the actual mp4 bytes (recon §11)
    return rec;
  }
  const rec = { image_url: key, subtype: "single_image", ...restMeta };
  if (saved) rec.image_file = `images/ad-${n}.jpg`;
  return rec;
}

// Direct fetch of a signed fbcdn mp4 url → write to disk if it's a valid, non-trivial mp4 (recon §11a:
// fbcdn video is token-authed not cookie-authed, so a bare GET returns the COMPLETE file — full 200, not a
// 206 range). PURE-ish (network + one write); returns { saved, bytes, reason }. NEVER fabricates a file:
// any non-200 / short body / non-mp4 magic → saved:false (the caller keeps the url-only fallback).
// `writer` is injected ({ writeFile, fetchFn }) so the wiring is unit-testable without real IO/network.
// BOUNDED: an AbortController deadline (timeoutMs) caps a hung CDN fetch — closing the harness CDP socket does
// NOT cancel a live Node fetch, so without this a stalled fbcdn node could eat the whole 180s budget. A
// Content-Length / buffer ceiling (maxBytes) guards against materializing an unexpectedly huge body.
export async function downloadVideoFile(fullUrl, destPath, { fetchFn = fetch, writeFile, timeoutMs = 30000, maxBytes = 50 * 1024 * 1024 } = {}) {
  if (!fullUrl || typeof fullUrl !== "string") return { saved: false, reason: "no url" };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(fullUrl, { signal: ac.signal });
    if (!res.ok) return { saved: false, reason: `status ${res.status}` };
    const cl = parseInt(res.headers?.get?.("content-length") || "0", 10);
    if (cl > maxBytes) return { saved: false, reason: `too large (${cl}B)` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) return { saved: false, reason: `too large (${buf.length}B)` };
    // valid mp4 = ISO-BMFF `ftyp` box at offset 4 (recon §11a magic `…66747970…`); non-trivial > 50KB.
    const isMp4 = buf.length > 8 && buf.slice(4, 8).toString("ascii") === "ftyp";
    if (buf.length <= 50 * 1024 || !isMp4) return { saved: false, reason: `invalid mp4 (${buf.length}B, magic ${buf.slice(4, 8).toString("hex")})` };
    if (writeFile) writeFile(destPath, buf);
    return { saved: true, bytes: buf.length };
  } catch (e) {
    return { saved: false, reason: e?.name === "AbortError" ? `timeout (${timeoutMs}ms)` : (e?.message || "fetch error") };
  } finally {
    clearTimeout(timer);
  }
}

// Direct fetch of a signed fbcdn IMAGE url → write to disk if it's a valid, non-trivial image (recon §12a:
// fbcdn image is token-authed not cookie-authed — same as video §11 — so a bare GET of the FULL signed
// scontent/t39.35426 url returns the COMPLETE jpg, full 200, content-length == bytes). The modal-driven Meta
// flow uses this to fetch EACH ad's creative asset by url right after reading it from the open card/modal, so
// every collected creative is built 1:1 with its own detail (no grid-buffer→drain join). Mirrors
// downloadVideoFile exactly: BOUNDED (AbortController timeout + maxBytes ceiling), NEVER fabricates a file
// (any non-200 / short body / wrong magic → saved:false, caller keeps a url-only fallback). `writer`/`fetchFn`
// are injected so the wiring is unit-testable without real IO/network.
// Magic-byte validation: JPEG `ffd8ff`, PNG `89504e47`, WEBP `RIFF…WEBP`, GIF `GIF8`. A small size floor
// (default 2KB) rejects page-chrome icon thumbnails the unscoped <img> sweep can pick up (recon §12a).
export async function downloadImageFile(fullUrl, destPath, { fetchFn = fetch, writeFile, timeoutMs = 30000, maxBytes = 25 * 1024 * 1024, minBytes = 2000 } = {}) {
  if (!fullUrl || typeof fullUrl !== "string") return { saved: false, reason: "no url" };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(fullUrl, { signal: ac.signal });
    if (!res.ok) return { saved: false, reason: `status ${res.status}` };
    const cl = parseInt(res.headers?.get?.("content-length") || "0", 10);
    if (cl > maxBytes) return { saved: false, reason: `too large (${cl}B)` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) return { saved: false, reason: `too large (${buf.length}B)` };
    if (buf.length < minBytes) return { saved: false, reason: `too small (${buf.length}B)` };
    if (!isImageMagic(buf)) return { saved: false, reason: `not an image (magic ${buf.slice(0, 4).toString("hex")})` };
    if (writeFile) writeFile(destPath, buf);
    return { saved: true, bytes: buf.length };
  } catch (e) {
    return { saved: false, reason: e?.name === "AbortError" ? `timeout (${timeoutMs}ms)` : (e?.message || "fetch error") };
  } finally {
    clearTimeout(timer);
  }
}

// True if the buffer's leading bytes are a known raster-image signature (JPEG/PNG/WEBP/GIF).
export function isImageMagic(buf) {
  if (!buf || buf.length < 12) return false;
  const h4 = buf.slice(0, 4).toString("hex");
  if (h4.startsWith("ffd8ff")) return true;                                   // JPEG
  if (h4 === "89504e47") return true;                                          // PNG
  if (buf.slice(0, 4).toString("ascii") === "GIF8") return true;              // GIF
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return true; // WEBP
  return false;
}
