// On-demand, READ-ONLY HTML viewer for analysis QA ("validate-recipe" mode). For ONE persona it gathers every
// collection run (grouped by collection date) and, per ad, renders the ad image + ad info + the analysis we
// extracted ("recipe") + quality badges that surface low-nutrition / mis-recognized analyses. The user inspects,
// then COPIES an ad's id (a label button) to take to the terminal and talk to the agent ("이 광고 재분석해줘").
//
// Read-only by design: NO POST, NO selection capture, NO file write/move. Judgment stays with the human; the
// correction loop is a terminal conversation, not a server action — so grounds_in/confidence discipline is never
// overwritten by an inline human edit. (Cf. select-images.mjs, which DOES capture a selection; this clones only
// its static-server skeleton.)
//
// Run it in the background (run_in_background:true): it serves until the user is done or the idle timeout fires.
//
// Usage: node shared/collect/validate-recipe.mjs <persona_id>

import http from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { safeName } from "./ad-source-helpers.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, "validate-recipe.template.html");
const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const STATE = process.env.GEN_ADS_IMG_STATE || ".generate-ads-img";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

// the recipe is read from the global lineage store (STATE_DIR/store/{persona}/{ad}/{kind}.json envelopes);
// map each recipe slot → its store `kind` (= filename). The image still comes from the run corpus (runs/...).
const STORE_KIND = { perception: "perception", adType: "ad-type", copy: "copy", layout: "layout", visual: "visual", intent: "intent", strategy: "strategy", gate: "ad-type-gate" };
const KOR = { visual: "비주얼", intent: "의도", adType: "타입", strategy: "전략", layout: "레이아웃" };

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return undefined; } };
const imageCreatives = (creatives) => (creatives || []).filter((c) => c && typeof c.image_file === "string" && IMG_RE.test(c.image_file));

// ---- pure: discover a persona's runs, grouped by collection date ------------------------------------------

// runDate: prefer the dated run-id prefix (datedRunId = "YYYY-MM-DD-…"), else run.json.created_at, else dir mtime.
export function runDate(runId, runJson, mtimeIso) {
  const m = String(runId).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  if (runJson && typeof runJson.created_at === "string") return runJson.created_at.slice(0, 10);
  return (mtimeIso || "").slice(0, 10) || "날짜 미상";
}

export function loadPersonaRuns(personaId, stateDir = STATE) {
  const runsRoot = resolve(stateDir, "runs");
  let dirs;
  try { dirs = readdirSync(runsRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
  const runs = [];
  for (const runId of dirs) {
    const personaDir = resolve(runsRoot, runId, "ad-creatives", personaId);
    const creativePath = resolve(personaDir, "ad-creative.json");
    if (!existsSync(creativePath)) continue;            // this run has no corpus for this persona
    const creative = readJson(creativePath);
    if (!creative) continue;
    const runJson = readJson(resolve(runsRoot, runId, "run.json"));
    let mtimeIso = ""; try { mtimeIso = statSync(resolve(runsRoot, runId)).mtime.toISOString(); } catch { /* ignore */ }
    runs.push({
      runId,
      personaId,
      date: runDate(runId, runJson, mtimeIso),
      creatives: imageCreatives(creative.creatives),
    });
  }
  return runs;
}

export function groupByDate(runs) {
  const byDate = new Map();
  for (const r of runs) { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date).push(r); }
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, rs]) => ({ date, runs: rs })); // newest first
}

// ---- pure: load one ad's recipe ----------------------------------------------------------------------------

// adBase = "ad-9" (image basename, the store slot). Reads each kind's ENVELOPE from the global store and unwraps
// its payload; missing → undefined. The store is persona-global (run-independent) — the canonical recipe home.
export function loadRecipe(personaId, adBase, stateDir = STATE) {
  const dir = resolve(stateDir, "store", personaId, adBase);
  const out = {};
  for (const [slot, kind] of Object.entries(STORE_KIND)) out[slot] = readJson(resolve(dir, `${kind}.json`))?.payload;
  return out;
}

// OUR generated items (kind=candidate) live in the same store, keyed by candidate_id (not an ad slot). Scan the
// persona index for slots that carry a candidate envelope → the dual "theirs (recipe) + ours (generated)" view.
export function loadGenerated(personaId, stateDir = STATE) {
  const idx = readJson(resolve(stateDir, "store", personaId, "index.json"));
  if (!idx?.items) return [];
  const out = [];
  for (const [slot, item] of Object.entries(idx.items)) {
    if (!item.kinds?.candidate) continue;
    const env = readJson(resolve(stateDir, "store", personaId, slot, "candidate.json"));
    if (env) out.push({ slot, pattern_tag: item.pattern_tag, derived_from: env.derived_from || [], payload: env.payload || {}, fullId: `store/${personaId}/${slot}/candidate.json` });
  }
  return out;
}

// NO quality verdict here — the system does NOT pre-grade the analysis. The whole reason a human does the recipe
// check is that the agent's grounds can be wrong, INCLUDING when it was confident (a confidently-wrong analysis
// would carry high confidence and so no "bad" flag — a badge would give false reassurance and make the human skip
// exactly the card they should scrutinise). So the viewer shows the recipe faithfully and the human judges. The
// agent's own confidence is shown transparently as data (labelled self-report), never as a system verdict.

// ---- pure: render -----------------------------------------------------------------------------------------

const dd = (val) => (val ? `<dd>${esc(val)}</dd>` : `<dd class="none">—</dd>`);

function recipeRows(recipe) {
  const t = recipe.adType;
  const typeLine = t ? [t.ad_type, t.execution_style].filter(Boolean).join(" / ") : "";
  const copyEls = recipe.copy?.copy_elements || [];
  const head = copyEls.find((e) => e.text_role === "headline") || copyEls[0];
  const reg = recipe.visual?.register || "";
  const s = recipe.strategy;
  const bf = s ? [s.benefit_vector?.primary, s.funnel_intent?.stage].filter(Boolean).join(" × ") : "";
  const cog = s?.first_cognition ? `${s.first_cognition.verdict ?? ""} (${s.first_cognition.total_score ?? "?"})`.trim() : "";
  // agent's OWN self-reported confidence — transparent data, NOT a system quality verdict. The human decides
  // whether the analysis is right by looking at the ad; this just shows what the agent claimed (incl. how sure).
  const conf = ["adType", "visual", "intent", "strategy", "layout"].map((k) => (recipe[k]?.confidence ? `${KOR[k]} ${recipe[k].confidence}` : "")).filter(Boolean).join(" · ");
  return `<dl class="recipe">`
    + `<dt>타입</dt>${dd(typeLine)}`
    + `<dt>카피</dt>${dd(head?.content)}`
    + `<dt>무드</dt>${dd(reg)}`
    + `<dt>혜택×퍼널</dt>${dd(bf)}`
    + `<dt>인지</dt>${dd(cog)}`
    + `<dt class="self">에이전트 자기보고 신뢰</dt>${dd(conf)}`
    + `</dl>`;
}

// OUR generated prompt candidate — no run image (it's a prompt); shows the spec + its lineage (← opportunity → matrix).
export function generatedCardHtml(item) {
  const p = item.payload || {};
  const copy = p.provider_neutral_spec?.copy || p.copy || {};
  const lineage = (item.derived_from || []).map((d) => d.kind).join(" ← ") || "—";
  return `
    <div class="card gen">
      <div class="body">
        <div class="info">생성 후보 · ${esc(p.angle || item.slot)}</div>
        <button class="idbtn" type="button" data-id="${esc(item.fullId)}" title="${esc(item.fullId)}">${esc(item.slot)}</button>
        <dl class="recipe">`
        + `<dt>헤드라인</dt>${dd(copy.headline)}`
        + `<dt>CTA</dt>${dd(copy.cta)}`
        + `<dt>포지션</dt>${dd(item.pattern_tag)}`
        + `<dt class="self">계보</dt>${dd(lineage)}`
        + `</dl>
      </div>
    </div>`;
}

export function cardHtml(runId, personaId, creative, recipe) {
  const file = creative.image_file;                       // "images/ad-9.jpg"
  const adBase = basename(file).replace(IMG_RE, "");       // "ad-9"
  // the canonical id the agent can locate — the image_ref carried in the analysis artifacts.
  const fullId = recipe.perception?.image_ref || `runs/${runId}/ad-creatives/${personaId}/${file}`;
  const info = [creative.advertiser_name, creative.started_at, creative.subtype].filter(Boolean).map(esc).join(" · ") || esc(adBase);
  // a NEUTRAL state note only — "analysed yet or not" is a fact, not a quality judgement.
  const body = recipe.perception ? recipeRows(recipe) : `<p class="noanalysis">아직 분석되지 않음</p>`;
  return `
    <div class="card">
      <img src="/img/${esc(runId)}/${esc(basename(file))}" loading="lazy" alt="${esc(adBase)}" />
      <div class="body">
        <div class="info">${info}</div>
        <button class="idbtn" type="button" data-id="${esc(fullId)}" title="${esc(fullId)}">${esc(adBase)}</button>
        ${body}
      </div>
    </div>`;
}

export function renderRecipeHtml({ personaId, groups, stateDir = STATE }, template) {
  const totalAds = groups.reduce((n, g) => n + g.runs.reduce((m, r) => m + r.creatives.length, 0), 0);
  const totalRuns = groups.reduce((n, g) => n + g.runs.length, 0);
  const generated = loadGenerated(personaId, stateDir);
  const meta = `페르소나 <b>${esc(personaId)}</b> · 수집 ${totalRuns}회(${groups.length}개 날짜) · 광고 ${totalAds}개 · 우리 생성물 ${generated.length}개`;
  // OUR generated items first (theirs+ours dual view) — so the human compares what we made against the source ads.
  const ourSection = generated.length
    ? `<section class="day gen"><h2>우리 생성물 (generated)</h2><div class="daysub">우리가 이 recipe로 만든 프롬프트 후보 — 아래 남의 광고와 대조</div>`
      + `<div class="grid">${generated.map(generatedCardHtml).join("")}</div></section>`
    : "";
  const sections = groups.length
    ? groups.map((g) => {
        const runIds = g.runs.map((r) => r.runId);
        const cards = g.runs.flatMap((r) => r.creatives.map((c) => cardHtml(r.runId, personaId, c, loadRecipe(personaId, basename(c.image_file).replace(IMG_RE, ""), stateDir)))).join("");
        return `<section class="day"><h2>${esc(g.date)}</h2><div class="daysub">run: ${esc(runIds.join(", "))}</div>`
          + `<div class="grid">${cards || `<p class="empty">이미지 없음</p>`}</div></section>`;
      }).join("")
    : `<p class="empty">이 페르소나로 수집된 런이 없습니다.</p>`;
  return template.replace("<!--META-->", () => meta).replace("<!--GROUPS-->", () => ourSection + sections);
}

// ---- CLI: render + serve (read-only) + self-exit -----------------------------------------------------------

function serveStatic(res, absPath, type) {
  try {
    const buf = readFileSync(absPath);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(buf);
  } catch { res.writeHead(404); res.end("not found"); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [personaRaw] = process.argv.slice(2);
  if (!personaRaw) { console.error("Usage: node shared/collect/validate-recipe.mjs <persona_id>"); process.exit(2); }
  const personaId = safeName(personaRaw, "persona_id");

  const runs = loadPersonaRuns(personaId);
  if (runs.length === 0) { console.error(`FAIL  no collected runs for persona '${personaId}' under ${STATE}/runs`); process.exit(1); }
  const groups = groupByDate(runs);
  const template = readFileSync(TEMPLATE, "utf8");
  const html = renderRecipeHtml({ personaId, groups }, template);
  const runsRoot = resolve(STATE, "runs");

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(html);
    }
    // /img/{runId}/{name} — read-only static, traversal-guarded (runId + basename), scoped to this persona's images.
    if (req.method === "GET" && req.url.startsWith("/img/")) {
      let runId, name;
      try {
        const parts = req.url.split(/[?#]/)[0].slice("/img/".length).split("/");
        runId = safeName(decodeURIComponent(parts.shift() || ""), "runId");
        name = basename(decodeURIComponent(parts.join("/")));
      } catch { res.writeHead(400); return res.end("bad request"); }
      const imagesDir = resolve(runsRoot, runId, "ad-creatives", personaId, "images");
      const abs = resolve(imagesDir, name);
      if (!IMG_RE.test(name) || !abs.startsWith(imagesDir)) { res.writeHead(403); return res.end("forbidden"); }
      return serveStatic(res, abs, MIME[extname(name).toLowerCase()] || "application/octet-stream");
    }
    res.writeHead(404); res.end("not found");   // read-only: nothing else is served
  });

  let lifeTimer;
  function shutdown(code = 0) {
    if (lifeTimer) clearTimeout(lifeTimer);
    server.closeAllConnections?.();
    server.close(() => process.exit(code));
    setTimeout(() => process.exit(code), 1500).unref();
  }

  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    console.log(`SELECT_URL http://127.0.0.1:${port}/`);
    console.log(`  Read-only analysis viewer for '${personaId}' (${runs.length} runs, ${groups.length} dates). Open in a browser.`);
    console.log(`  Red-badged cards may be low-quality analyses — click an ad's 📋 id to copy it, then tell the agent here (e.g. "이 광고 재분석해줘").`);
    const timeoutMin = Number(process.env.SELECT_TIMEOUT_MIN) || 30;
    lifeTimer = setTimeout(() => { console.log(`TIMEOUT idle ${timeoutMin}m — shutting down. Re-run to view again.`); shutdown(0); }, timeoutMin * 60_000);
  });
}
