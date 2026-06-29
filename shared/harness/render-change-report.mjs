// Deterministic renderer for creative-change-report.json. No LLM-generated HTML.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const webPath = (p) => String(p).split(sep).join("/");
const chip = (label, cls = "") => `<span class="chip${cls ? ` ${esc(cls)}` : ""}">${esc(label)}</span>`;
const list = (items = []) => items.length ? `<ol class="claim-list">${items.map((x) => `<li>${chip(x.claim_kind, `chip-${x.claim_kind}`)}<span>${esc(x.summary)}</span></li>`).join("")}</ol>` : `<p class="empty">not observed / not supplied</p>`;
const flags = (items = []) => items.length ? `<ul class="flags">${items.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="empty">reported gaps 없음</p>`;
const byLibraryId = (snapshot) => new Map((snapshot?.ads || []).filter((ad) => ad.library_id).map((ad) => [ad.library_id, ad]));

function readJsonIfExists(path) {
  if (!path || !existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function findStateDir(startDir) {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(resolve(dir, "runs"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadSnapshot(snapshotId, reportDir, stateDir) {
  if (!snapshotId) return null;
  const file = `creative-snapshot.${snapshotId}.json`;
  return readJsonIfExists(resolve(reportDir, file))
    || (stateDir ? readJsonIfExists(resolve(stateDir, "runs", snapshotId, "creative-change", file)) : null);
}

export function loadRenderContext({ reportPath, outPath, reportPayload }) {
  const reportDir = dirname(resolve(reportPath));
  const stateDir = findStateDir(reportDir);
  const fromId = reportPayload?.snapshot_range?.from_snapshot_id;
  const toId = reportPayload?.snapshot_range?.to_snapshot_id;
  const resolvedOut = resolve(outPath || resolve(reportDir, "creative-change-report.html"));
  return {
    diff: readJsonIfExists(resolve(reportDir, "creative-diff.json")),
    candidates: readJsonIfExists(resolve(reportDir, "change-candidates.json")),
    snapshots: {
      from: loadSnapshot(fromId, reportDir, stateDir),
      to: loadSnapshot(toId, reportDir, stateDir),
    },
    assetExists: (imageRef) => {
      const ref = String(imageRef || "");
      if (!stateDir || !ref.startsWith("runs/")) return undefined;
      return existsSync(resolve(stateDir, ref));
    },
    resolveAssetRef: (imageRef) => {
      const ref = String(imageRef || "");
      if (!stateDir || !ref.startsWith("runs/")) return ref;
      return webPath(relative(dirname(resolvedOut), resolve(stateDir, ref)));
    },
  };
}

function assetSrc(imageRef, context) {
  const ref = String(imageRef || "");
  if (!ref) return "";
  if (typeof context.resolveAssetRef === "function") return context.resolveAssetRef(ref);
  if (context.assetBase) return `${String(context.assetBase).replace(/\/$/, "")}/${ref.replace(/^\/+/, "")}`;
  return ref;
}

function recipeChips(ad, changedAxes = []) {
  const c = ad?.static_recipe?.classified || {};
  const values = [
    ["appeal", c.appeal],
    ["funnel", c.funnel_stage || c.funnel_intent_stage],
    ["benefit", c.benefit_primary],
    ["visual", c.visual_register],
    ["layout", c.composition_type],
    ["copy", Array.isArray(c.text_roles) ? c.text_roles.join(", ") : c.copy_role],
    ["audience", c.audience_read],
  ].filter(([, value]) => value);
  if (!values.length) return `<p class="microcopy">No classified recipe available</p>`;
  return `<div class="recipe-chips">${values.map(([key, value]) => chip(`${key}: ${value}`, changedAxes.includes(key) || changedAxes.includes(`${key}_stage`) ? "chip-axis chip-changed" : "chip-axis")).join("")}</div>`;
}

function creativeFigure(ad, label, context, changedAxes = []) {
  if (!ad) return `<div class="creative-side creative-missing"><h4>${esc(label)}</h4><div class="media-frame missing">not supplied</div></div>`;
  const src = assetSrc(ad.image_ref, context);
  const missingAsset = typeof context.assetExists === "function" && context.assetExists(ad.image_ref) === false;
  return `<div class="creative-side">
    <h4>${esc(label)}</h4>
    <div class="media-frame${missingAsset ? " missing" : ""}">${src && !missingAsset ? `<img src="${esc(src)}" alt="${esc(label)} ${esc(ad.library_id || ad.ad_key || "creative")}" loading="lazy" />` : `<span>${src ? "image file not present" : "image ref missing"}</span>`}</div>
    <div class="creative-meta">${chip(ad.library_id || ad.ad_key || "local", "chip-id")}${ad.started_at ? chip(`started ${ad.started_at}`, "chip-muted") : ""}</div>
    ${recipeChips(ad, changedAxes)}
  </div>`;
}

function changedAxisSummary(change) {
  const axes = change?.changed_axes || [];
  if (!axes.length) return "";
  return `<div class="axis-delta">${axes.map((axis) => {
    const before = change.before?.[axis];
    const after = change.after?.[axis];
    if (/hash/i.test(axis)) return `<span><b>${esc(axis)}</b> changed</span>`;
    return `<span><b>${esc(axis)}</b>${before != null || after != null ? ` ${esc(before ?? "missing")} → ${esc(after ?? "missing")}` : ""}</span>`;
  }).join("")}</div>`;
}

function renderUpdatedCreatives(diff, snapshots, context) {
  const fromMap = byLibraryId(snapshots?.from);
  const toMap = byLibraryId(snapshots?.to);
  const changes = diff?.update_delta?.same_library_id_changed_recipe || [];
  if (!changes.length) return `<p class="empty">No persisted creative recipe updates detected.</p>`;
  return changes.map((change) => `<article class="evidence-row">
    <header class="evidence-head">
      <h3>Updated</h3>
      <div>${chip(change.library_id, "chip-id")}${(change.changed_axes || []).map((axis) => chip(axis, "chip-axis chip-changed")).join("")}</div>
    </header>
    <div class="creative-pair">
      ${creativeFigure(fromMap.get(change.library_id), "Before", context, change.changed_axes)}
      ${creativeFigure(toMap.get(change.library_id), "After", context, change.changed_axes)}
    </div>
    ${changedAxisSummary(change)}
  </article>`).join("");
}

function inventoryFigure(ad, label, context, side) {
  return `<article class="inventory-item">
    <h3>${esc(label)}</h3>
    ${creativeFigure(ad, side, context)}
  </article>`;
}

function renderInventoryCreatives(diff, snapshots, context) {
  const fromMap = byLibraryId(snapshots?.from);
  const toMap = byLibraryId(snapshots?.to);
  const created = diff?.inventory_delta?.created || [];
  const deleted = diff?.inventory_delta?.deleted || [];
  if (!created.length && !deleted.length) return "";
  const createdHtml = created.map((ad) => inventoryFigure(toMap.get(ad.library_id) || ad, "Created", context, "After")).join("");
  const deletedHtml = deleted.map((ad) => inventoryFigure(fromMap.get(ad.library_id) || ad, "Deleted", context, "Before")).join("");
  return `<div class="inventory-grid">${createdHtml}${deletedHtml}</div>`;
}

function renderCreativeEvidence(context) {
  const diff = context.diff;
  if (!diff) return `<section class="section evidence"><h2>Before / After Creatives</h2><p class="empty">creative-diff artifact not supplied</p></section>`;
  return `<section class="section evidence">
    <div class="section-heading">
      <h2>Before / After Creatives</h2>
      <p>Images are displayed from existing artifact references; no image re-analysis is performed.</p>
    </div>
    ${renderUpdatedCreatives(diff, context.snapshots, context)}
    ${renderInventoryCreatives(diff, context.snapshots, context)}
  </section>`;
}

function renderCandidateBar(candidates = []) {
  if (!candidates.length) return "";
  return `<div class="candidate-bar">${candidates.map((c) => `<div class="candidate-chip">
    ${chip(c.candidate_type, "chip-candidate")}
    ${chip(c.strength, "chip-strength")}
    <span>${esc(c.axis)} · Δ ${esc(c.share_delta ?? 0)} · n=${esc(c.support_count ?? 0)}</span>
  </div>`).join("")}</div>`;
}

export function renderChangeReport(report, context = {}) {
  const candidates = context.candidates?.candidates || [];
  return `<!doctype html>
	<html lang="ko">
	<head>
	  <meta charset="utf-8" />
	  <meta name="viewport" content="width=device-width, initial-scale=1" />
	  <title>Creative Change Report</title>
	  <style>
	    :root { color-scheme: light; --ink:#171717; --muted:#626a6a; --line:#d9dddd; --paper:#f7f8f8; --panel:#ffffff; --accent:#0f766e; --warn:#8a5a00; }
	    * { box-sizing: border-box; }
	    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); letter-spacing: 0; }
	    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
	    .hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: end; padding: 30px 0 24px; border-bottom: 1px solid var(--line); }
	    h1 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 720; }
	    h2 { margin: 0; font-size: 21px; line-height: 1.2; font-weight: 680; }
	    h3 { margin: 0; font-size: 15px; line-height: 1.2; font-weight: 680; }
	    h4 { margin: 0 0 8px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0; }
	    p { line-height: 1.62; }
	    .meta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
	    .section { padding: 26px 0; border-bottom: 1px solid var(--line); }
	    .section-heading { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 28px; align-items: start; margin-bottom: 16px; }
	    .section-heading p, .empty, .microcopy { margin: 0; color: var(--muted); }
	    .summary { max-width: 900px; font-size: 17px; }
	    .chip { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--muted); font-size: 12px; line-height: 1.2; white-space: nowrap; }
	    .chip-computed, .chip-candidate { color: #075985; border-color: #b8d7e8; background: #f2f9fc; }
	    .chip-interpreted { color: var(--accent); border-color: #a7d8d0; background: #f0faf8; }
	    .chip-inferred { color: #7c3aed; border-color: #d8c7ff; background: #f7f3ff; }
	    .chip-strength { color: #7a3e00; border-color: #edc987; background: #fff8e8; }
	    .chip-id { color: #222; background: #f1f3f3; }
	    .chip-axis { color: #4f514b; background: #f8faf9; }
	    .chip-changed { color: #9f2d20; border-color: #f0b8ad; background: #fff4f2; }
	    .chip-muted { background: transparent; }
	    .candidate-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
	    .candidate-chip { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); font-size: 12px; }
	    .claim-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
	    .claim-list li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; padding: 12px 0; border-top: 1px solid #e5e9e8; }
	    .evidence-row { padding: 18px 0 24px; border-top: 1px solid #d6dddd; }
	    .evidence-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 12px; }
	    .evidence-head div, .creative-meta, .recipe-chips { display: flex; flex-wrap: wrap; gap: 6px; }
	    .creative-pair, .inventory-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
	    .creative-side { min-width: 0; }
	    .media-frame { aspect-ratio: 4 / 5; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #eef1f1; }
	    .media-frame img { width: 100%; height: 100%; object-fit: contain; display: block; transition: transform .18s ease; }
	    .media-frame:hover img { transform: scale(1.018); }
	    .media-frame.missing { color: var(--muted); font-size: 13px; }
	    .creative-meta { margin-top: 9px; }
	    .recipe-chips { margin-top: 8px; }
	    .axis-delta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; color: var(--muted); font-size: 13px; }
	    .axis-delta span { padding: 6px 8px; border-radius: 6px; background: #fff; border: 1px solid var(--line); }
	    .inventory-grid { margin-top: 14px; }
	    .inventory-item { min-width: 0; padding-top: 18px; border-top: 1px solid #e5e9e8; }
	    .flags { margin: 0; padding-left: 18px; color: var(--warn); }
	    .flags li { margin: 6px 0; }
	    @media (max-width: 760px) {
	      main { padding: 22px 16px 40px; }
	      .hero, .section-heading, .creative-pair, .inventory-grid { grid-template-columns: 1fr; }
	      .meta { justify-content: flex-start; }
	      .claim-list li { grid-template-columns: 1fr; gap: 7px; }
	      .candidate-chip { flex-wrap: wrap; }
	      h1 { font-size: 28px; }
	    }
	  </style>
	</head>
	<body>
	  <main>
	    <header class="hero">
	      <div>
	        <h1>Creative Change Report</h1>
	        <p class="summary">${esc(report.synthesis || "서술 없음")}</p>
	      </div>
	      <div class="meta">
	        ${chip(`persona ${report.persona_id}`, "chip-id")}
	        ${chip(`${report.snapshot_range?.from_snapshot_id} → ${report.snapshot_range?.to_snapshot_id}`, "chip-muted")}
	      </div>
	    </header>
	    <section class="section">
	      <div class="section-heading">
	        <h2>Change Candidates</h2>
	        <p>Deterministic candidate signals used by the analyst.</p>
	      </div>
	      ${renderCandidateBar(candidates) || `<p class="empty">not observed / not supplied</p>`}
	    </section>
	    ${renderCreativeEvidence(context)}
	    <section class="section">
	      <div class="section-heading"><h2>계산된 변화</h2><p>Observed or computed facts from the snapshot edge.</p></div>
	      ${list(report.confirmed_changes)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>해석된 변화</h2><p>Marketing interpretation over deterministic candidates.</p></div>
	      ${list(report.classified_interpretations)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>유추 가설</h2><p>External context hypotheses only; never causal proof.</p></div>
	      ${list(report.inferred_hypotheses)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>Coverage Flags</h2><p>Known limits and missing inputs.</p></div>
	      ${flags(report.coverage_flags)}
	    </section>
	  </main>
	</body>
	</html>`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inPath = process.argv[2];
  if (!inPath) { console.error("Usage: node shared/harness/render-change-report.mjs <creative-change-report.json> [out.html]"); process.exit(2); }
	  const payload = JSON.parse(readFileSync(inPath, "utf8"));
	  const ok = report("creative-change-report input", validateAgainst("creative-change-report.schema.json", payload));
	  if (!ok) process.exit(1);
	  const outPath = process.argv[3] ?? resolve(dirname(inPath), "creative-change-report.html");
	  const context = loadRenderContext({ reportPath: inPath, outPath, reportPayload: payload });
	  mkdirSync(dirname(outPath), { recursive: true });
	  writeFileSync(outPath, renderChangeReport(payload, context), "utf8");
	  console.log(`SAVED creative-change-report → ${outPath}`);
	}
