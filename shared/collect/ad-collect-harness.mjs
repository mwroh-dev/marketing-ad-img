// Platform-agnostic ad-collection harness. Owns the CDP lifecycle, image capture via
// Network.getResponseBody (CORS/paint-proof), dedup, output schema, finally-close + hard
// timeout. Per-platform flow is injected by an adapter:
//   { source, region, acceptModes:string[], imgMatch(url):bool, async collect(ctx):void }
//
// ctx primitives given to adapter.collect:
//   queries                  the (already mode-filtered) query list
//   evalJs(expr)             in-page Runtime.evaluate, returnByValue
//   goto(url) -> bool        navigate + wait + STOP-on-block (false if blocked)
//   scroll(steps)            real wheel scroll loop
//   type(text)               real keyboard entry into the focused/first <input> (Korean-safe)
//   clickSuggestion(sel)->bool   hover+real-click first matching element (Angular-overlay safe)
//   resetBuffer()            clear the seen-image buffer (call before each entry)
//   sleep(ms)                bounded settle wait (e.g. after a modal-open click, before reading)
//   esc()                    real ESC key (rawKeyDown+keyUp) — close an open modal/overlay
//   drain(meta, metaByKey)   getResponseBody on buffered image/video (classifyResponse) responses → save + push.
//                            `meta` merges into EVERY saved record; `metaByKey` (optional
//                            { [dedupKey(url)]: extraMeta }) merges per-creative — the
//                            deterministic image-URL join used to attach detail-modal fields
//                            to the right creative (network order ≠ card order, so key-join).
//   flag(msg)                push a coverage flag
//   limitReached() -> bool   totalCap hit or blocked
//
// Non-intrusive: dedicated headless Chrome (default 9291), never bringToFront/activateTarget.
import { realScroll, sleep, isBlocked, matchToolEntry } from "./lib.mjs";
import { dedupKey, safeName, classifyResponse, buildCreativeRecord } from "./ad-source-helpers.mjs";
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
    captured_at: "live-cdp-run",
  };
}

export async function runCollection({ adapter, queries, personaId, runId, port = 9291, totalCap = 24 }) {
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
  const buf = new Map();
  // Hard timeout: never process.exit() from a library — it skips the finally cleanup and kills any
  // parent process. Instead flag + close the socket so in-flight CDP calls reject and adapter.collect
  // unwinds; the catch below turns that into a blocked/partial result, and the finally still runs.
  let timedOut = false;
  const guard = setTimeout(() => { timedOut = true; console.error("ad-collect: hard timeout — aborting source"); c.close().catch(() => {}); }, 180000);
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
      evalJs,
      limitReached: () => result.creatives.length >= totalCap || result.blocked,
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
      // Real keyboard entry. Input.insertText is browser-native and Korean/Unicode-safe
      // (per-key dispatchKeyEvent drops Hangul via IME); it fires trusted input events that
      // drive the page's autocomplete. NOT DOM value injection.
      // Real text entry: focus the SOURCE'S search box (selector from the flow — not a guessed
      // generic 'input') → Input.insertText (browser-native, Hangul-safe; NOT DOM value injection).
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
      // Material overlay items to register the click (live-confirmed). Waits for navigation.
      clickAt: async (x, y) => {
        await c.Input.dispatchMouseEvent({ type: "mouseMoved", x, y });
        await sleep(300);
        await c.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await sleep(80);
        await c.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await sleep(7000);
      },
      esc: async () => {
        // Real ESC keypress (rawKeyDown + keyUp) — recon-confirmed modal close. NOT a synthetic
        // JS KeyboardEvent; this is a browser-level Input event (same trust class as a real key).
        await c.Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
        await c.Input.dispatchKeyEvent({ type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
        await sleep(1200);
      },
      drain: async (meta = {}, metaByKey = null) => {
        await sleep(1200);
        for (const [u, { rid, kind }] of buf) {
          const key = dedupKey(u);
          if (seen.has(key) || result.creatives.length >= totalCap) continue;
          // per-creative detail merged via the deterministic image-URL key join (card <img> src ==
          // network response url, query-stripped). Falls back to {} so a creative with no matched
          // detail is still saved (detail_captured stays falsy/absent — never a fabricated join).
          const perKey = (metaByKey && metaByKey[key]) || {};
          const fullMeta = { ...meta, ...perKey };
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
              result.creatives.push(buildCreativeRecord({ kind: "image", key, n, meta: fullMeta, saved: true }));
            }
          } catch (e) {
            // Video bytes often unavailable via getResponseBody (MSE/range). Keep the URL, skip the file.
            const isVideoEvict = kind === "video" && /evict|No resource|No data found/i.test(e?.message ?? "");
            if (isVideoEvict) {
              if (!seen.has(key) && result.creatives.length < totalCap) {
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
