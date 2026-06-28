// Human keep/delete review via a browser image grid — replaces the inline-Read presentation of the human
// review gate (data-collection.md). One script for BOTH tracks (category_keyword + competitor); they share the
// identical on-disk layout, so only {run_id, persona_id} differ.
//
// Flow: render a static grid from ad-creative.json → spin a ONE-SHOT localhost server (node:http, no deps,
// OS-assigned port) → auto-open the browser → the user clicks images to KEEP → 확인 POSTs the kept set →
// the server writes screening/screen-{persona}.json (image-screening.schema shape, reason user_removed for the
// rest), MOVES the unselected images to images/_removed/ (recoverable, not hard-deleted), advances the run
// stage to human_reviewed, responds ok, then self-exits. Truth lives in that JSON, never in the browser.
//
// Run it in the background (run_in_background:true): it blocks until the user confirms; on self-exit the harness
// re-invokes the orchestrator, which reads the screen JSON and proceeds to the deterministic screen + analysis.
//
// Usage: node shared/collect/select-images.mjs <run_id> <persona_id>

import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { advanceStage } from "./run-manifest.mjs";
import { safeName } from "./ad-source-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, "select-grid.template.html");
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// ---- pure: build the keep/delete page from ad-creative.json + run.json -------------------------------------

// metaLine: a one-line provenance header (run id, persona, track, queries) so the user knows what they're picking.
export function metaLine({ runId, personaId, track, queries }) {
  const qs = (queries || []).map((q) => q.query).filter(Boolean);
  const qstr = qs.length ? `검색어: ${qs.map(esc).join(", ")}` : "검색어 정보 없음";
  const trk = track === "competitor" ? "경쟁사 광고" : track === "category_keyword" ? "카테고리/키워드 광고" : (track || "광고");
  return `Run <b>${esc(runId)}</b> · 페르소나 <b>${esc(personaId)}</b> · ${esc(trk)} · ${qstr}`;
}

// imageCreatives: only creatives that have an actual image file (videos are not part of the grid for now).
export function imageCreatives(creatives) {
  return (creatives || []).filter((c) => c && typeof c.image_file === "string" && IMG_RE.test(c.image_file));
}

export function cardHtml(c) {
  const file = c.image_file;                                   // e.g. "images/ad-0.jpg"
  const cap = c.advertiser_name
    ? esc(c.advertiser_name) + (c.started_at ? ` · ${esc(c.started_at)}` : "")
    : esc(basename(file));
  const copy = c.ad_copy ? `\n      <span class="copy">${esc(c.ad_copy)}</span>` : "";
  return `
    <div class="card" data-file="${esc(file)}">
      <img src="/${esc(file)}" loading="lazy" alt="${esc(basename(file))}" />
      <span class="check"></span>
      <span class="cap">${cap}</span>${copy}
    </div>`;
}

// ---- pure: model-B keyword grouping (one ad = every keyword that surfaced it; sections by exact combo) -------

export const UNGROUPED_LABEL = "미분류";

// the sorted, de-duplicated keyword set of a creative (the "signature" identity for grouping).
export function keywordSet(c) {
  const ks = Array.isArray(c?.keywords) ? c.keywords : [];
  return [...new Set(ks.map((k) => String(k ?? "").trim()).filter(Boolean))].sort();
}

// stable sort by started_at ASCENDING (oldest first); creatives with no started_at sink to the end.
export function sortByStartedAt(items) {
  return items
    .map((c, i) => [c, i])
    .sort(([a, ia], [b, ib]) => {
      const da = a.started_at || "", db = b.started_at || "";
      if (!da && !db) return ia - ib;                 // both undated → preserve original order
      if (!da) return 1;                              // undated sinks below dated
      if (!db) return -1;
      return da < db ? -1 : da > db ? 1 : ia - ib;    // ISO YYYY-MM-DD → lexical compare == chronological
    })
    .map(([c]) => c);
}

// group image creatives by their EXACT keyword combination (model B). Sections: most keywords first, then
// label A→Z; 미분류 (no keyword) always last. Items inside a section: oldest started_at first.
export function groupByKeywordSignature(creatives) {
  const imgs = imageCreatives(creatives);
  const byLabel = new Map();
  for (const c of imgs) {
    const keys = keywordSet(c);
    const label = keys.length ? keys.join(" · ") : UNGROUPED_LABEL;
    if (!byLabel.has(label)) byLabel.set(label, { label, count: keys.length, items: [] });
    byLabel.get(label).items.push(c);
  }
  const groups = [...byLabel.values()];
  groups.sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)); // count → 미분류(0) last
  for (const g of groups) g.items = sortByStartedAt(g.items);
  return groups;
}

export function sectionHtml(group, { showHeader }) {
  const cards = group.items.map(cardHtml).join("");
  if (!showHeader) return `<section class="kw-section">${cards ? `<div class="grid">${cards}</div>` : ""}</section>`;
  const head = group.label === UNGROUPED_LABEL
    ? `${esc(UNGROUPED_LABEL)} <span class="kw-note">키워드 정보 없음</span>`
    : `키워드: ${esc(group.label)}`;
  return `
    <section class="kw-section">
      <h1 class="kw-h1">${head} <span class="kw-count">${group.items.length}</span></h1>
      <hr class="divider" />
      <div class="grid">${cards}</div>
    </section>`;
}

export function renderSelectHtml({ runId, personaId, track, queries, creatives }, template) {
  const groups = groupByKeywordSignature(creatives);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // Only one group AND it's 미분류 (e.g. older runs with no keyword data) → render bare grid, no section header.
  const showHeader = !(groups.length === 1 && groups[0].label === UNGROUPED_LABEL);
  const body = total
    ? groups.map((g) => sectionHtml(g, { showHeader })).join("")
    : `<p class="empty">이 런/페르소나에 표시할 이미지가 없습니다.</p>`;
  // Function replacements — a string value containing $&, $$, $`, $' would be parsed as a special replacement
  // pattern (advertiser names / queries / keywords are arbitrary text). A function disables that parsing entirely.
  return template
    .replace("<!--META-->", () => metaLine({ runId, personaId, track, queries }))
    .replace("<!--CARDS-->", () => body)
    .replace("<!--TOTAL-->", () => String(total));
}

// ---- pure: build the screening JSON (image-screening.schema shape) ----------------------------------------

// allImageFiles + the user's kept set → {run_id, persona_id, total, kept, dropped[user_removed]}.
// Matching is by basename so a kept entry from the page (full "images/x") lines up with any path form.
export function buildScreenJson(runId, personaId, allImageFiles, keptImageFiles) {
  const keptBase = new Set((keptImageFiles || []).map((f) => basename(f)));
  const kept = [];
  const dropped = [];
  for (const f of allImageFiles) {
    if (keptBase.has(basename(f))) kept.push(f);
    else dropped.push({ image_file: f, reason: "user_removed" });
  }
  return { run_id: runId, persona_id: personaId, total: kept.length + dropped.length, kept, dropped };
}

// ---- side-effect: move the unselected images to images/_removed/ (recoverable, never hard-deleted) ---------

export function moveUnselected(imagesDir, keptImageFiles) {
  const keptBase = new Set((keptImageFiles || []).map((f) => basename(f)));
  let files;
  try { files = readdirSync(imagesDir).filter((f) => IMG_RE.test(f)); }
  catch { return []; }
  const toMove = files.filter((f) => !keptBase.has(f));
  if (toMove.length === 0) return [];
  const removedDir = resolve(imagesDir, "_removed");
  try { if (!existsSync(removedDir)) mkdirSync(removedDir, { recursive: true }); }   // create once, not per file
  catch (e) { console.warn(`  (could not create _removed/: ${e.message})`); return []; }
  const moved = [];
  for (const f of toMove) {
    // One file failing (lock / permission / vanished) must not abort the rest.
    try { renameSync(resolve(imagesDir, f), resolve(removedDir, f)); moved.push(f); }
    catch (e) { console.warn(`  (could not move ${f} to _removed/: ${e.message})`); }
  }
  return moved;
}

// ---- CLI: render + serve + capture + commit + self-exit ---------------------------------------------------

function serveStatic(res, absPath, type) {
  try {
    const buf = readFileSync(absPath);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [runIdRaw, personaIdRaw] = process.argv.slice(2);
  if (!runIdRaw || !personaIdRaw) {
    console.error("Usage: node shared/collect/select-images.mjs <run_id> <persona_id>");
    process.exit(2);
  }
  const runId = safeName(runIdRaw, "run_id");
  const personaId = safeName(personaIdRaw, "persona_id");

  const personaDir = resolve(`.generate-ads-img/runs/${runId}/ad-creatives/${personaId}`);
  const imagesDir = resolve(personaDir, "images");
  const creativePath = resolve(personaDir, "ad-creative.json");
  const runJsonPath = resolve(`.generate-ads-img/runs/${runId}/run.json`);
  const screenOut = resolve(`.generate-ads-img/runs/${runId}/screening/screen-${personaId}.json`);

  if (!existsSync(creativePath)) {
    console.error(`FAIL  no ad-creative.json at ${creativePath} — collect first`);
    process.exit(1);
  }
  let creative;
  try { creative = JSON.parse(readFileSync(creativePath, "utf8")); }
  catch (e) { console.error(`FAIL  malformed ad-creative.json at ${creativePath}: ${e.message}`); process.exit(1); }
  let run = {};
  if (existsSync(runJsonPath)) {
    try { run = JSON.parse(readFileSync(runJsonPath, "utf8")); }
    catch (e) { console.warn(`  (ignoring malformed run.json at ${runJsonPath}: ${e.message})`); }   // header-only; non-fatal
  }
  const imgs = imageCreatives(creative.creatives);
  const allImageFiles = imgs.map((c) => c.image_file);
  const template = readFileSync(TEMPLATE, "utf8");
  const html = renderSelectHtml(
    { runId, personaId, track: run.track, queries: run.queries || creative.queries, creatives: creative.creatives },
    template,
  );

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(html);
    }
    if (req.method === "GET" && req.url.startsWith("/images/")) {
      let name;
      // Drop any ?query/#hash (cache-busting params etc.), then decode. decodeURIComponent throws URIError on
      // malformed % escapes — that would crash the request listener, so guard it.
      try {
        const pathname = req.url.split(/[?#]/)[0];
        name = basename(decodeURIComponent(pathname.slice("/images/".length)));   // basename → no path traversal
      } catch { res.writeHead(400); return res.end("bad request"); }
      const abs = resolve(imagesDir, name);
      if (!IMG_RE.test(name) || !abs.startsWith(imagesDir)) { res.writeHead(403); return res.end("forbidden"); }
      return serveStatic(res, abs, MIME[extname(name).toLowerCase()] || "application/octet-stream");
    }
    if (req.method === "POST" && req.url === "/select") {
      req.setEncoding("utf8");   // decode as utf8 so a multi-byte char split across TCP chunks isn't corrupted
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on("end", () => {
        let kept;
        try { kept = JSON.parse(body).kept; } catch { res.writeHead(400); return res.end("bad json"); }
        if (!Array.isArray(kept)) { res.writeHead(400); return res.end("kept must be an array"); }

        // Wrap the disk commit: a failure (permission/disk-full/missing dir) must not crash the listener or
        // leave the client hanging. On error, respond 500 and KEEP the server alive so the user can retry.
        let screen, moved, staged = false;
        try {
          screen = buildScreenJson(runId, personaId, allImageFiles, kept);
          mkdirSync(dirname(screenOut), { recursive: true });
          writeFileSync(screenOut, JSON.stringify(screen, null, 2) + "\n", "utf8");
          moved = moveUnselected(imagesDir, kept);
          try { advanceStage(runId, "human_reviewed", { kept_by_human: screen.kept.length }); staged = true; }
          catch (e) { console.warn(`  (stage not advanced: ${e.message})`); }
        } catch (err) {
          console.error(`FAIL  could not save selection: ${err.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "could not save selection" }));
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, kept: screen.kept.length, moved: moved.length }));  // 1) ACK the browser first

        console.log(`SELECTED ${runId}/${personaId} → kept ${screen.kept.length}, moved ${moved.length} to images/_removed/${staged ? ", stage → human_reviewed" : ""}`);
        console.log(`  screen: ${screenOut}`);
        // 2) let the response fully flush to the browser before tearing down the socket — shutdown()'s
        //    closeAllConnections() would otherwise RST the in-flight response (ECONNRESET / false "save failed").
        setTimeout(() => shutdown(0), 100);   // harness re-invokes the orchestrator on exit
      });
      return;
    }
    res.writeHead(404); res.end("not found");
  });

  // Single owner of termination — never leave a stray/zombie server. Drops idle keep-alive sockets so close()
  // returns at once, with a hard exit fallback if it still hangs.
  let lifeTimer;
  function shutdown(code = 0) {
    if (lifeTimer) clearTimeout(lifeTimer);
    server.closeAllConnections?.();                       // node ≥18.2: release keep-alive sockets immediately
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 1500).unref();   // fallback: exit even if close() is wedged
  }

  // No auto-open (avoids an untestable cross-platform browser-launch path). The orchestrator relays this URL to
  // the user, who opens it in any browser. The server blocks here until the user confirms (POST /select).
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/`;
    console.log(`SELECT_URL ${url}`);
    console.log(`  Open this URL in a browser, pick the ${allImageFiles.length} images to KEEP, then click 확인. Waiting…`);
    // Abandonment guard: if the user closes the tab without confirming, self-exit instead of running forever.
    const timeoutMin = Number(process.env.SELECT_TIMEOUT_MIN) || 30;
    lifeTimer = setTimeout(() => {
      console.log(`TIMEOUT no selection within ${timeoutMin}m — shutting down to avoid a stray server. Re-run to retry.`);
      shutdown(0);
    }, timeoutMin * 60_000);
  });
}
