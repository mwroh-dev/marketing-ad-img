// Deterministic renderer for creative-change-report.json. No LLM-generated HTML.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const webPath = (p) => String(p).split(sep).join("/");
const chip = (label, cls = "") => `<span class="chip${cls ? ` ${esc(cls)}` : ""}">${esc(label)}</span>`;
const list = (items = []) => items.length ? `<ol class="claim-list">${items.map((x) => `<li>${chip(claimKindLabel(x.claim_kind), `chip-${x.claim_kind}`)}<span>${esc(humanizeSummary(x.summary))}</span></li>`).join("")}</ol>` : `<p class="empty">관측되거나 제공된 내용 없음</p>`;
const flags = (items = []) => items.length ? `<ul class="flags">${items.map((f) => `<li>${esc(humanizeFlag(f))}</li>`).join("")}</ul>` : `<p class="empty">표시할 분석 한계 없음</p>`;
const byLibraryId = (snapshot) => new Map((snapshot?.ads || []).filter((ad) => ad.library_id).map((ad) => [ad.library_id, ad]));

const CLAIM_LABELS = {
  observed: "관측",
  classified: "분류",
  computed: "확인",
  interpreted: "해석",
  inferred: "가설",
};

const CANDIDATE_LABELS = {
  inventory_change: "광고 구성 변화",
  appeal_shift: "소구점 변화",
  funnel_shift: "퍼널 변화",
  benefit_shift: "혜택 변화",
  visual_register_shift: "비주얼 톤 변화",
  layout_shift: "레이아웃 변화",
  copy_role_shift: "카피 역할 변화",
  audience_read_shift: "읽히는 대상 변화",
};

const STRENGTH_LABELS = {
  strong: "강함",
  medium: "보통",
  weak: "약함",
};

const AXIS_LABELS = {
  inventory: "광고 구성",
  text_hash: "문구 변경",
  image_asset_hash: "이미지 변경",
  appeal: "소구점",
  funnel_stage: "퍼널",
  funnel: "퍼널",
  funnel_intent_stage: "구매 단계",
  benefit_primary: "혜택",
  benefit: "혜택",
  visual_register: "비주얼 톤",
  visual: "비주얼 톤",
  scene_setting: "장면",
  product_state: "제품 표현",
  composition_type: "레이아웃",
  layout: "레이아웃",
  text_density: "텍스트 밀도",
  copy_role: "카피 역할",
  copy: "카피",
  ad_type: "광고 타입",
  execution_style: "표현 방식",
  audience_read: "읽히는 대상",
  audience: "읽히는 대상",
};

const VALUE_LABELS = {
  quality_proof: "품질 증명",
  social_proof: "사회적 증거",
  emotional: "감성",
  price: "가격",
  discount: "할인",
  trust: "신뢰",
  convenience: "편의",
  consideration: "고려 단계",
  comparison: "비교 단계",
  conversion: "구매 전환",
  awareness: "인지",
  clean_minimal: "깔끔한 미니멀",
  studio_plain: "스튜디오형",
  review_capture: "리뷰 캡처형",
  raw_authentic: "날것의 진정성",
  standalone: "단독 제품",
  headline: "헤드라인",
  badge: "배지",
  cta: "CTA",
  testimonial: "후기형",
  proof_seeker: "근거 중시",
  price_sensitive: "가격 민감",
  social_validation_seeker: "사회적 검증 중시",
  convenience_seeker: "편의 중시",
  aspirational_buyer: "선망형 구매자",
  risk_avoidant: "리스크 회피",
  strong: "강함",
  medium: "보통",
  weak: "약함",
  unclear: "불명확",
};

function claimKindLabel(kind) {
  return CLAIM_LABELS[kind] || kind || "항목";
}

function candidateLabel(type) {
  return CANDIDATE_LABELS[type] || humanizeToken(type);
}

function strengthLabel(strength) {
  return STRENGTH_LABELS[strength] || strength || "확인";
}

function axisLabel(axis) {
  return AXIS_LABELS[axis] || humanizeToken(axis);
}

function humanizeToken(value) {
  return String(value ?? "").replace(/_/g, " ");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SUMMARY_TOKEN_RULES = Object.entries({ ...AXIS_LABELS, ...VALUE_LABELS, ...CANDIDATE_LABELS })
  .map(([from, to]) => ({ find: new RegExp(`\\b${escapeRegex(from)}\\b`, "g"), replace: to }));

const SUMMARY_REPLACEMENT_RULES = [
  { find: /인벤토리 변화/g, replace: "광고 구성 변화" },
  { find: /인벤토리/g, replace: "광고 구성" },
  { find: /\brecipe\b/g, replace: "구성" },
  { find: /레시피/g, replace: "구성" },
  { find: /구성가/g, replace: "구성이" },
  { find: /비주얼 레지스터/g, replace: "비주얼 톤" },
  { find: /구성이 변경됨/g, replace: "구성이 바뀌었습니다" },
  { find: /strength=강함/g, replace: "강도는 강함" },
  { find: /strength=보통/g, replace: "강도는 보통" },
  { find: /strength=약함/g, replace: "강도는 약함" },
  { find: /품질 증명\(품질 증명\)/g, replace: "품질 증명" },
  { find: /감성\(감성\)/g, replace: "감성" },
  { find: /문구 변경와/g, replace: "문구와" },
  { find: /\bfrom\b/g, replace: "이전" },
  { find: /\bto\b/g, replace: "이후" },
  { find: /\bdelta\b/g, replace: "변화폭" },
  { find: /\bsupport_count\b/g, replace: "근거 수" },
  { find: /\bchanged_axes\b/g, replace: "변경 항목" },
  { find: /변경 항목\s*=\s*/g, replace: "바뀐 항목: " },
  { find: /근거 수 ([0-9]+)/g, replace: "근거 $1건" },
  { find: /바뀌었습니다:\s*바뀐 항목:/g, replace: "바뀌었습니다. 바뀐 항목:" },
];

const SUMMARY_FORMAT_RULES = [
  {
    find: /소구점=(.+?) 비중이 이전 ([0-9.-]+)에서 이후 ([0-9.-]+)(?:으)?로 변화\(변화폭 ([0-9.-]+), 근거(?: 수)? ([0-9]+)(?:건)?\)\.?/g,
    replace: (_match, value, from, to, delta, support) => {
      return `${value} 소구 비중이 ${formatShare(from)}에서 ${formatShare(to)}로 바뀌었습니다. 변화폭 ${formatDelta(delta)}, 근거 ${support}건.`;
    },
  },
  {
    find: /(품질 증명|감성|가격|할인|신뢰|사회적 증거|편의)\(([0-9.]+)→([0-9.]+)\)/g,
    replace: (_match, label, from, to) => {
      return `${label}(${formatShare(from)}→${formatShare(to)})`;
    },
  },
];

function applySummaryRules(text, rules) {
  return rules.reduce((out, rule) => out.replace(rule.find, rule.replace), text);
}

function humanValue(value) {
  if (value == null) return "없음";
  const s = String(value);
  return VALUE_LABELS[s] || humanizeToken(s);
}

function formatDelta(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return humanValue(value);
  if (Math.abs(n) <= 1) {
    const pct = Math.round(n * 1000) / 10;
    return `${pct > 0 ? "+" : ""}${pct}%p`;
  }
  return `${n > 0 ? "+" : ""}${n}`;
}

function formatShare(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return humanValue(value);
  if (n >= 0 && n <= 1) return `${Math.round(n * 1000) / 10}%`;
  return String(value);
}

function humanizeSummary(summary) {
  const text = String(summary || "");
  if (/변화 없는 축\s*:/.test(text)) return "퍼널, 혜택, 비주얼 톤, 레이아웃 등 주요 구조는 유지되었습니다.";
  return applySummaryRules(
    applySummaryRules(
      applySummaryRules(text, SUMMARY_TOKEN_RULES),
      SUMMARY_REPLACEMENT_RULES,
    ),
    SUMMARY_FORMAT_RULES,
  );
}

function humanizeFlag(flag) {
  const text = String(flag || "");
  if (text.startsWith("external_context_not_supplied:")) return "외부 맥락 자료가 없어 시즌/이벤트 관련 가설은 제외했습니다.";
  if (text.startsWith("competitive_trend_not_supplied:")) return "경쟁 추세 자료가 없어 경쟁사 흐름 해석은 제외했습니다.";
  if (text.startsWith("single_edge_only:")) return "한 구간 비교이므로 장기 추세로 단정하지 않습니다.";
  if (text.startsWith("no_performance_data:")) return "성과 데이터가 없어 효과 여부는 판단하지 않습니다.";
  return humanizeSummary(text.replace(/^[a-z_]+:\s*/, ""));
}

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
  if (!values.length) return `<p class="microcopy">분류 정보 없음</p>`;
  return `<div class="recipe-chips">${values.map(([key, value]) => chip(`${axisLabel(key)}: ${humanValue(value)}`, changedAxes.includes(key) || changedAxes.includes(`${key}_stage`) ? "chip-axis chip-changed" : "chip-axis")).join("")}</div>`;
}

function creativeFigure(ad, label, context, changedAxes = []) {
  if (!ad) return `<div class="creative-side creative-missing"><h4>${esc(label)}</h4><div class="media-frame missing">자료 없음</div></div>`;
  const src = assetSrc(ad.image_ref, context);
  const missingAsset = typeof context.assetExists === "function" && context.assetExists(ad.image_ref) === false;
  return `<div class="creative-side">
    <h4>${esc(label)}</h4>
    <div class="media-frame${missingAsset ? " missing" : ""}">${src && !missingAsset ? `<img src="${esc(src)}" alt="${esc(label)} ${esc(ad.library_id || ad.ad_key || "광고")}" loading="lazy" />` : `<span>${src ? "이미지 파일 없음" : "이미지 경로 없음"}</span>`}</div>
    <div class="creative-meta">${chip(ad.library_id || ad.ad_key || "local", "chip-id")}${ad.started_at ? chip(`시작 ${ad.started_at}`, "chip-muted") : ""}</div>
    ${recipeChips(ad, changedAxes)}
  </div>`;
}

function changedAxisSummary(change) {
  const axes = change?.changed_axes || [];
  if (!axes.length) return "";
  return `<div class="axis-delta">${axes.map((axis) => {
    const before = change.before?.[axis];
    const after = change.after?.[axis];
    if (/hash/i.test(axis)) return `<span><b>${esc(axisLabel(axis))}</b> 변경됨</span>`;
    return `<span><b>${esc(axisLabel(axis))}</b>${before != null || after != null ? ` ${esc(humanValue(before))} → ${esc(humanValue(after))}` : ""}</span>`;
  }).join("")}</div>`;
}

function renderUpdatedCreatives(diff, snapshots, context) {
  const fromMap = byLibraryId(snapshots?.from);
  const toMap = byLibraryId(snapshots?.to);
  const changes = diff?.update_delta?.same_library_id_changed_recipe || [];
  if (!changes.length) return `<p class="empty">유지된 광고에서 감지된 레시피 변경은 없습니다.</p>`;
  return changes.map((change) => `<article class="evidence-row">
    <header class="evidence-head">
      <h3>변경</h3>
      <div>${chip(change.library_id, "chip-id")}${(change.changed_axes || []).map((axis) => chip(axisLabel(axis), "chip-axis chip-changed")).join("")}</div>
    </header>
    <div class="creative-pair">
      ${creativeFigure(fromMap.get(change.library_id), "이전", context, change.changed_axes)}
      ${creativeFigure(toMap.get(change.library_id), "이후", context, change.changed_axes)}
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
  const createdHtml = created.map((ad) => inventoryFigure(toMap.get(ad.library_id) || ad, "신규", context, "이후")).join("");
  const deletedHtml = deleted.map((ad) => inventoryFigure(fromMap.get(ad.library_id) || ad, "종료", context, "이전")).join("");
  return `<div class="inventory-grid">${createdHtml}${deletedHtml}</div>`;
}

function renderCreativeEvidence(context) {
  const diff = context.diff;
  if (!diff) return `<section class="section evidence"><h2>전후 광고 비교</h2><p class="empty">전후 비교 자료가 없습니다.</p></section>`;
  return `<section class="section evidence">
    <div class="section-heading">
      <h2>전후 광고 비교</h2>
    </div>
    ${renderUpdatedCreatives(diff, context.snapshots, context)}
    ${renderInventoryCreatives(diff, context.snapshots, context)}
  </section>`;
}

function renderCandidateBar(candidates = []) {
  if (!candidates.length) return "";
  return `<div class="candidate-bar">${candidates.map((c) => `<div class="candidate-chip">
    ${chip(candidateLabel(c.candidate_type), "chip-candidate")}
    ${chip(strengthLabel(c.strength), "chip-strength")}
    <span>${esc(axisLabel(c.axis))} · 변화폭 ${esc(formatDelta(c.share_delta ?? 0))} · 근거 ${esc(c.support_count ?? 0)}건</span>
  </div>`).join("")}</div>`;
}

function renderAgentPrompt(report) {
  const from = report.snapshot_range?.from_snapshot_id || "이전 스냅샷";
  const to = report.snapshot_range?.to_snapshot_id || "이후 스냅샷";
  const promptText = [
    "다음 광고 변화 분석 산출물을 바탕으로, 한국어로 마케팅 관점의 인사이트를 정리해줘.",
    "",
    `분석 범위: ${report.persona_id}`,
    `비교 구간: ${from} → ${to}`,
    "",
    "사용할 산출물:",
    `- 전후 광고 스냅샷: creative-snapshot.${from}.json, creative-snapshot.${to}.json`,
    "- 비교 결과: creative-diff.json",
    "- 변화 후보: change-candidates.json",
    "- 최종 리포트: creative-change-report.json",
    "",
    "요청:",
    "1. 확인된 변화, 해석, 가능한 가설을 구분해줘.",
    "2. 성과나 인과는 단정하지 말고, 데이터 한계를 명시해줘.",
    "3. 사람이 읽기 쉬운 한국어로 요약해줘.",
    "4. 이미지를 새로 판독하지 말고, 제공된 산출물만 근거로 사용해줘.",
  ].join("\n");
  return `<section class="section prompt-section">
    <div class="section-heading">
      <h2>에이전트 분석 프롬프트</h2>
    </div>
    <div class="prompt-box">
      <button type="button" class="copy-button" onclick="navigator.clipboard && navigator.clipboard.writeText(document.getElementById('agent-prompt').value)">프롬프트 복사</button>
      <textarea id="agent-prompt" readonly spellcheck="false">${esc(promptText)}</textarea>
    </div>
  </section>`;
}

export function renderChangeReport(report, context = {}) {
  const candidates = context.candidates?.candidates || [];
  return `<!doctype html>
	<html lang="ko">
	<head>
	  <meta charset="utf-8" />
	  <meta name="viewport" content="width=device-width, initial-scale=1" />
	  <title>광고 변화 분석</title>
	  <style>
	    :root { color-scheme: light; --ink:#171717; --muted:#626a6a; --line:#d9dddd; --paper:#f7f8f8; --panel:#ffffff; --accent:#0f766e; --warn:#8a5a00; }
	    * { box-sizing: border-box; }
	    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--paper); letter-spacing: 0; }
	    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
	    .hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: end; padding: 30px 0 24px; border-bottom: 1px solid var(--line); }
	    h1 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 720; }
	    h2 { margin: 0; font-size: 21px; line-height: 1.2; font-weight: 680; }
	    h3 { margin: 0; font-size: 15px; line-height: 1.2; font-weight: 680; }
	    h4 { margin: 0 0 8px; font-size: 12px; color: var(--muted); letter-spacing: 0; }
	    p { line-height: 1.62; }
	    .meta { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
	    .section { padding: 26px 0; border-bottom: 1px solid var(--line); }
	    .section-heading { margin-bottom: 16px; }
	    .empty, .microcopy { margin: 0; color: var(--muted); }
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
	    .prompt-box { display: grid; gap: 10px; }
	    .copy-button { justify-self: start; min-height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; }
	    .copy-button:hover { border-color: #9fb7b4; }
	    textarea { width: 100%; min-height: 230px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: #242827; font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
	    @media (max-width: 760px) {
	      main { padding: 22px 16px 40px; }
	      .hero, .creative-pair, .inventory-grid { grid-template-columns: 1fr; }
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
	        <h1>광고 변화 분석</h1>
	        <p class="summary">${esc(humanizeSummary(report.synthesis || "서술 없음"))}</p>
	      </div>
	      <div class="meta">
	        ${chip(`분석 범위 ${report.persona_id}`, "chip-id")}
	        ${chip(`${report.snapshot_range?.from_snapshot_id} → ${report.snapshot_range?.to_snapshot_id}`, "chip-muted")}
	      </div>
	    </header>
	    <section class="section">
	      <div class="section-heading">
	        <h2>주요 변화</h2>
	      </div>
	      ${renderCandidateBar(candidates) || `<p class="empty">관측되거나 제공된 내용 없음</p>`}
	    </section>
	    ${renderCreativeEvidence(context)}
	    <section class="section">
	      <div class="section-heading"><h2>확인된 변화</h2></div>
	      ${list(report.confirmed_changes)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>마케팅 해석</h2></div>
	      ${list(report.classified_interpretations)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>가능한 가설</h2></div>
	      ${list(report.inferred_hypotheses)}
	    </section>
	    <section class="section">
	      <div class="section-heading"><h2>분석 한계</h2></div>
	      ${flags(report.coverage_flags)}
	    </section>
	    ${renderAgentPrompt(report)}
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
