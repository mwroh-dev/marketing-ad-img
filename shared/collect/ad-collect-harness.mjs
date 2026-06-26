// Platform-agnostic ad-collection harness. Owns the CDP lifecycle, image capture via
// Network.getResponseBody (CORS/paint-proof), dedup, output schema, finally-close + hard timeout.
// Per-platform flow is injected by an adapter: { source, region, acceptModes, imgMatch(url), async collect(ctx) }.
// collect(ctx) gets: queries · evalJs · goto · scroll · type · suggestions · clickAt · pollUntil · esc ·
// collectCreative · drain · flag · limitReached · resetBuffer · sleep — each documented inline at its definition.
// Non-intrusive: dedicated headless Chrome (default 9291), never bringToFront/activateTarget.
import { realScroll, sleep, isBlocked, matchToolEntry } from "./lib.mjs";
import { dedupKey, fbcdnAssetId, safeName, classifyResponse, buildCreativeRecord, appendKeyword, downloadVideoFile, downloadImageFile } from "./ad-source-helpers.mjs";
import CDP from "chrome-remote-interface";
import { writeFileSync, mkdirSync } from "fs";

export function makeResult({ personaId, source, queries, mode }) {
  return {
    persona_id: personaId,
    source,
    search: { mode, query: (queries || []).map((q) => q.query).join(", "), category: "all_ads", country: "KR" },
    queries,
    creatives: [],
    coverage_flags: [],
    blocked: false,
    // Real capture instant (ISO-8601) — the temporal key the competitive-trend aggregator orders
    // snapshots by. Was a "live-cdp-run" label; a timestamp is the field's literal meaning and is what
    // makes cross-run time-series (first_seen/last_seen, new/disappeared) possible. The dry-run path keeps
    // its "dry-run" sentinel (genuinely not a capture) so the aggregator can skip non-dated snapshots.
    captured_at: new Date().toISOString(),
  };
}

export async function runCollection({ adapter, queries, personaId, runId, port = 9291, totalImages = 50, imagesPerQuery = 8, hardTimeoutMs = 1800000 }) {
  const allowedEntrypoints = adapter.entrypoints || []; // CODE-enforced no-URL-assembly whitelist
  safeName(runId, "runId"); safeName(personaId, "personaId"); safeName(adapter.source, "source");
  const outDir = `.generate-ads-img/runs/${runId}/ad-creatives/${personaId}`;
  const imgDir = `${outDir}/images`;
  const vidDir = `${outDir}/videos`;
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(vidDir, { recursive: true });
  const result = makeResult({ personaId, source: adapter.source, queries, mode: queries[0]?.mode || "advertiser" });
  if (!queries.length) console.warn("runCollection: queries is empty — check competitor source / filterQueriesByModes");

  const tgt = await CDP.New({ port, url: "about:blank" });
  const c = await CDP({ port, target: tgt.id });
  const seen = new Set();
  const seenRec = new Map();   // dedupKey → the saved creative record, so a dup (same ad, ANOTHER keyword) can append its keyword (model B)
  let imagesCollected = 0;   // IMAGE creatives are the PRIMARY budget; videos are uncapped, collected incidentally
  const buf = new Map();
  // Hard timeout: never process.exit() from a library — it skips the finally cleanup and kills any
  // parent process. Instead flag + close the socket so in-flight CDP calls reject and adapter.collect
  // unwinds; the catch below turns that into a blocked/partial result, and the finally still runs.
  let timedOut = false;
  // Stop is progress-driven (image target or exhaustion) with per-step timeouts; hardTimeoutMs is only a far
  // backstop against a pathological hang. On overrun: flag + graceful partial (catch below), never a crash.
  const guard = setTimeout(() => { timedOut = true; console.error(`ad-collect: hard timeout (${hardTimeoutMs / 1000}s) — aborting source`); c.close().catch(() => {}); }, hardTimeoutMs);
  try {
    await c.Page.enable(); await c.Runtime.enable(); await c.Network.enable();
    // Deterministic layout viewport. The default headless visual viewport is short (innerHeight ≈ 469) and
    // mismatches the OS window, which leaves modal content (e.g. a detail-modal's lower accordion) far below
    // the fold — scrollIntoView can't recover it and a CDP click at its clientY no-ops. setDeviceMetricsOverride
    // forces a clean tall layout+visual viewport so modal controls stay on-screen and clickable. (live: Task 6)
    await c.Emulation.setDeviceMetricsOverride({ width: 1280, height: 1696, deviceScaleFactor: 1, mobile: false }).catch(() => {});
    // ko-KR language preference (NOT stealth — a language header, per cdp-non-intrusive UA-normalization carve-out):
    // the user's real ad library renders Korean, so the collected detail labels match the KR target.
    await c.Network.setExtraHTTPHeaders({ headers: { "Accept-Language": "ko-KR,ko;q=0.9" } }).catch(() => {});
    try { const ua = await c.Runtime.evaluate({ expression: "navigator.userAgent", returnByValue: true }); await c.Network.setUserAgentOverride({ userAgent: ua.result.value, acceptLanguage: "ko-KR,ko;q=0.9" }); } catch { /* best-effort locale */ }
    c.Network.responseReceived((p) => {
      const u = (p.response && p.response.url) || "";
      const kind = classifyResponse(u, adapter, (p.response && p.response.mimeType) || "");
      if (kind) buf.set(u, { rid: p.requestId, kind });
    });
    const evalJs = async (e) => {
      const { result: r, exceptionDetails } = await c.Runtime.evaluate({ expression: e, returnByValue: true });
      if (exceptionDetails) throw new Error(`evalJs page exception: ${exceptionDetails.text || exceptionDetails.exception?.description || "unknown"}`);
      return r.value;
    };

    const ctx = {
      queries,
      imagesPerQuery,              // per-keyword IMAGE cap (spread image collection across keywords)
      evalJs,
      limitReached: () => imagesCollected >= totalImages || result.blocked,   // IMAGE target = the stop
      resetBuffer: () => buf.clear(),
      sleep: (ms) => sleep(ms),   // bounded settle wait (e.g. after a modal-open click before reading the dialog)
      flag: (s) => result.coverage_flags.push(s),
      scroll: async (steps = 4) => { for (let i = 0; i < steps; i++) { await realScroll(c, 1500); await sleep(900); } },
      goto: async (url) => {
        // no-URL-assembly enforced in CODE: navigate only if origin+path is a whitelisted public
        // front-door (matchToolEntry ignores query — filter params ARE allowed on the front-door host/path,
        // per the public-ad-transparency carve-out; a result deep-link path or off-whitelist host is rejected).
        if (allowedEntrypoints.length && !matchToolEntry(url, allowedEntrypoints)) {
          result.blocked = true;
          console.error(`STOP url-assembly: ${url} — host+path is not a whitelisted public front-door`);
          return false;
        }
        await c.Page.navigate({ url });
        await Promise.race([c.Page.loadEventFired(), sleep(7000)]);
        await sleep(1500); // SPA settle after load
        // Body read can throw on a hostile/half-loaded page; log but don't crash collection — a real
        // bot-wall is still caught by isBlocked when the text IS readable.
        let bodyText = "";
        try { bodyText = await evalJs("document.body?document.body.innerText.slice(0,400):''"); }
        catch (e) { console.error("goto: body read failed:", e?.message); }
        if (isBlocked(bodyText)) { result.blocked = true; return false; }
        return true;
      },
      // Real text entry: focus the flow's search-box selector (not a guessed generic 'input') → Input.insertText
      // (browser-native; fires trusted input events that drive autocomplete; Hangul-safe — unlike per-key
      // dispatchKeyEvent which drops Hangul via IME — and NOT DOM value injection).
      type: async (text, { selector = "input", waitMs = 3000 } = {}) => {
        await evalJs(`document.querySelector(${JSON.stringify(selector)})?.focus()`);
        await sleep(400);
        await c.Input.insertText({ text });
        await sleep(waitMs);
      },
      // Poll up to ~6s for elements matching `sel`; return [{text, x, y}] (viewport-center
      // coords + innerText) so the adapter can pick the right one (e.g. name-match advertiser).
      suggestions: async (sel) => {
        for (let i = 0; i < 12; i++) {
          const list = await evalJs(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(sel)})].map(e=>{const r=e.getBoundingClientRect();return{text:e.innerText,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width,h:r.height}}).filter(o=>o.w>0&&o.h>0))`);
          const arr = JSON.parse(list || "[]");
          if (arr.length) return arr;
          await sleep(500);
        }
        return [];
      },
      // Real mouse click at viewport coords. The hover (mouseMoved) is REQUIRED for Angular
      // Material overlay items to register the click (live-confirmed).
      // `postWaitMs` is the settle wait AFTER release. DEFAULT 7000 = the JS-navigation wait google's
      // suggestion-click depends on (clickAt → /advertiser/AR<id> nav) — leaving the default unchanged
      // keeps the google flow's behavior identical. The Meta accordion click passes a SHORT value (it then
      // event-driven polls HAS_FOLLOWER itself), so it no longer eats a flat 7s per card. (full-coverage)
      clickAt: async (x, y, postWaitMs = 7000) => {
        await c.Input.dispatchMouseEvent({ type: "mouseMoved", x, y });
        await sleep(300);
        await c.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await sleep(80);
        await c.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await sleep(postWaitMs);
      },
      // Poll an in-page boolean expression until true (or bound hit). Returns true if it became true.
      // Event-driven replacement for fixed settle sleeps (modal-open, accordion-expand): proceed as soon
      // as the DOM is in the expected state instead of always paying the worst-case wait. (full-coverage)
      pollUntil: async (expr, { timeoutMs = 5000, intervalMs = 300 } = {}) => {
        const deadline = Date.now() + timeoutMs;
        for (;;) {
          let ok = false;
          try { ok = await evalJs(expr); } catch { ok = false; }
          if (ok) return true;
          if (Date.now() >= deadline) return false;
          await sleep(intervalMs);
        }
      },
      esc: async () => {
        // Real ESC keypress (rawKeyDown + keyUp) — recon-confirmed modal close. NOT a synthetic
        // JS KeyboardEvent; this is a browser-level Input event (same trust class as a real key).
        await c.Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
        await c.Input.dispatchKeyEvent({ type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
        await sleep(1200);
      },
      // MODAL-DRIVEN per-ad creative collection (Meta rearch). The flow drives 1:1 from the modal pass: for
      // EACH ad it reads that ad's creative asset url(s) from the open card/modal and calls collectCreative,
      // which FETCHES the bytes by the FULL signed url (recon §11/§12: fbcdn is token-authed, a bare GET of the
      // signed url returns the complete file) and writes images/ad-N.jpg + (for video ads) videos/ad-N.mp4,
      // then builds ONE record via buildCreativeRecord with THIS ad's detail attached. Because the record is
      // built from its own modal pass, detail is 1:1 by construction — no grid-buffer→drain join, no mis-join
      // even when two ads resell the same asset (each gets its own record + own detail).
      //
      //   imageKey   query-stripped image url (the stable dedup/join id stored in image_url) — REQUIRED
      //   imageFull  the FULL signed image url to fetch (NEVER persisted) — optional; fall back to url-only if absent/fails
      //   videoKey   query-stripped mp4 url (video ads) → record becomes subtype "video"; image bytes are the poster
      //   videoFull  the FULL signed mp4 url to fetch (NEVER persisted) — optional
      //   meta       this ad's normalized detail (detail_captured etc.) merged into the record
      // Dedups on imageKey (a creative already collected this run is skipped — but a re-collect by ANOTHER ad
      // with its OWN detail is still its own correct record because each modal pass is independent; the dedup
      // here only prevents the SAME url being written twice within the modal loop). Honors the image budget.
      // Returns { collected, index, imageSaved, videoSaved, reason }.
      collectCreative: async ({ imageKey, imageFull = null, videoKey = null, videoFull = null, meta = {}, keyword = null } = {}) => {
        // VIDEO ad → video-only: mp4 to videos/, no poster in images/ (a video's first frame is not an image ad).
        // Videos are uncapped (collected while hunting images).
        if (videoKey) {
          const vkey = dedupKey(videoKey);
          // dup = the SAME ad surfaced again under another keyword → record that keyword on the existing
          // record instead of discarding (model B: one ad belongs to every keyword that surfaced it).
          if (seen.has(vkey)) { appendKeyword(seenRec.get(vkey), keyword); return { collected: false, reason: "dup" }; }
          const n = result.creatives.length;
          let videoSaved = false;
          if (videoFull) {
            const dl = await downloadVideoFile(videoFull, `${vidDir}/ad-${n}.mp4`, { writeFile: (p, b) => writeFileSync(p, b) });
            videoSaved = dl.saved;
            result.coverage_flags.push(dl.saved
              ? `video downloaded (${(dl.bytes / 1024).toFixed(0)}KB) → videos/ad-${n}.mp4`
              : `video not downloaded (${dl.reason}) — url only`);
          }
          seen.add(vkey);
          const rec = buildCreativeRecord({ kind: "video", key: vkey, n, meta, saved: videoSaved, keyword });
          result.creatives.push(rec); seenRec.set(vkey, rec);
          return { collected: true, index: n, videoSaved };
        }
        // IMAGE ad → one image to images/ (best-effort; url-only fallback). Images are the budget — refuse past target.
        if (!imageKey || typeof imageKey !== "string") return { collected: false, reason: "no imageKey" };
        const key = dedupKey(imageKey);
        if (seen.has(key)) { appendKeyword(seenRec.get(key), keyword); return { collected: false, reason: "dup" }; }
        if (imagesCollected >= totalImages) return { collected: false, reason: "image-cap" };
        const n = result.creatives.length;
        let imageSaved = false;
        if (imageFull) {
          const dl = await downloadImageFile(imageFull, `${imgDir}/ad-${n}.jpg`, { writeFile: (p, b) => writeFileSync(p, b) });
          imageSaved = dl.saved;
          if (!dl.saved) result.coverage_flags.push(`image not downloaded (${dl.reason}) — url only`);
        }
        seen.add(key);
        const rec = buildCreativeRecord({ kind: "image", key, n, meta, saved: imageSaved, keyword });
        result.creatives.push(rec); seenRec.set(key, rec);
        imagesCollected++;
        return { collected: true, index: n, imageSaved };
      },
      drain: async (meta = {}, metaByKey = null, metaByAsset = null) => {
        await sleep(1200);
        for (const [u, { rid, kind }] of buf) {
          const key = dedupKey(u);
          if (seen.has(key) || imagesCollected >= totalImages) continue;   // image target = stop (Google drain)
          // per-creative detail merged via the deterministic image-URL key join (card <img> src ==
          // network response url, query-stripped). Falls back to {} so a creative with no matched
          // detail is still saved (detail_captured stays falsy/absent — never a fabricated join).
          let perKey = (metaByKey && metaByKey[key]) || null;
          // ADDITIVE FALLBACK (only when the PRIMARY key missed): fbcdn serves the same asset under
          // different path/size variants, so a buffered creative url can have a different query-stripped
          // dedupKey than the card <img>.src the detail was stored under. Try the size-invariant asset id —
          // but attach ONLY a UNIQUE, non-conflicted detail (metaByAsset already dropped any asset-id that
          // ≥2 distinct ads claimed). This never overrides a primary match and can only ever add the SAME
          // ad's own detail to a CDN-variant creative — never another advertiser's. google passes no
          // metaByAsset → this branch is inert. (live: closes the 3 single_image variant-mismatch misses)
          if (!perKey && metaByAsset) {
            const aid = fbcdnAssetId(u);
            const byAsset = aid ? metaByAsset[aid] : null;
            if (byAsset) {
              perKey = byAsset;
              result.coverage_flags.push(`detail attached via asset-id fallback: ${aid}`);
            }
          }
          const fullMeta = { ...meta, ...(perKey || {}) };
          try {
            const b = await c.Network.getResponseBody({ requestId: rid });
            const bytes = b.base64Encoded ? Buffer.from(b.body, "base64") : Buffer.from(b.body);
            if (bytes.length <= 2000) continue;
            seen.add(key);
            const n = result.creatives.length;
            if (kind === "video") {
              writeFileSync(`${vidDir}/ad-${n}.mp4`, bytes);
              result.creatives.push(buildCreativeRecord({ kind: "video", key, n, meta: fullMeta, saved: true }));
            } else {
              writeFileSync(`${imgDir}/ad-${n}.jpg`, bytes);
              // drain is the buffer→getResponseBody path (Google). Meta no longer uses it (modal-driven
              // collectCreative replaced it), so there is no per-card detail/video here — a plain image record.
              result.creatives.push(buildCreativeRecord({ kind: "image", key, n, meta: fullMeta, saved: true }));
              imagesCollected++;
            }
          } catch (e) {
            // Video bytes often unavailable via getResponseBody (MSE/range). Keep the URL, skip the file.
            const isVideoEvict = kind === "video" && /evict|No resource|No data found/i.test(e?.message ?? "");
            if (isVideoEvict) {
              if (!seen.has(key)) {              // videos uncapped
                seen.add(key);
                const n = result.creatives.length;
                result.creatives.push(buildCreativeRecord({ kind: "video", key, n, meta: fullMeta, saved: false }));
                result.coverage_flags.push("video bytes unavailable — url only");
              }
            } else {
              console.error("drain skip:", key, e?.message);
            }
          }
        }
      },
    };

    try {
      await adapter.collect(ctx);
    } catch (e) {
      if (timedOut) { result.blocked = true; result.coverage_flags.push("hard-timeout (180s) — partial result"); }
      else throw e;
    }
    if (!result.creatives.length && !result.blocked) result.coverage_flags.push("no creatives");
  } finally {
    clearTimeout(guard);
    await c.close().catch(() => {});
    // c.close() closes only the CDP socket — also close the Chrome tab so repeated
    // runCollection calls in one process don't accumulate orphan tabs (Chrome OOM/hang).
    await CDP.Close({ port, id: tgt.id }).catch(() => {});
  }

  // failure-trajectory retention (anti-survivorship): a blocked/partial run leaves a queryable trace,
  // not just success artifacts. The dominant failure here is bot-walls.
  if (result.blocked || result.coverage_flags.some((f) => /blocked/i.test(f))) {
    const failDir = `.generate-ads-img/runs/${runId}/failures`;
    mkdirSync(failDir, { recursive: true });
    writeFileSync(`${failDir}/${adapter.source}.json`, JSON.stringify({
      run_id: runId, source: adapter.source, persona_id: personaId, blocked: result.blocked,
      coverage_flags: result.coverage_flags, creatives_collected: result.creatives.length,
      at: new Date().toISOString(),
    }, null, 2) + "\n");
    console.error(`FAILURE-TRACE → ${failDir}/${adapter.source}.json`);
  }
  writeFileSync(`${outDir}/ad-creative.json`, JSON.stringify(result, null, 2) + "\n");
  // manifest boundary (budget-spill): image bytes live on disk under images/; only THIS manifest path is
  // meant to cross back to the orchestrator/LLM — never raw page bytes or full ad dumps.
  console.log(`SAVED ${result.creatives.length} creatives from ${adapter.source} (blocked=${result.blocked}) → ${outDir}/ad-creative.json`);
  return result;
}
