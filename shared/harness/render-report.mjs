// Deterministic renderer: competitive-trend.json → competitive-report.html. No LLM, no network.
// Reads the authored-once template (competitive-report.template.html) and replaces its <!--TOKEN--> markers
// with HTML-escaped fragments built from the trend aggregate. An LLM never regenerates the HTML per run.
//
// Honesty: absent data renders an explicit "not yet observable / more snapshots needed" note — never fabricated rows. Every
// coverage_flag is surfaced (the provenance/gap trail required by completion-verification-policy).
//
// Usage: node shared/harness/render-report.mjs <competitive-trend.json> [out.html]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, "competitive-report.template.html");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function longevitySection(t) {
  if (!t.longevity_top_k || !t.longevity_top_k.length) {
    return `<p class="empty">게재기간(started_at)이 캡처된 광고가 없어 장수 순위를 산출할 수 없습니다. ${t.coverage_flags?.some((f) => /started_at/.test(f)) ? "상세모달 캡처를 확인하세요." : ""}</p>`;
  }
  const rows = t.longevity_top_k.map((a, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(a.advertiser_name ?? "—")}</td>
        <td>${esc(a.library_id)}</td>
        <td class="num">${esc(a.running_days)}일</td>
        <td>${a.status ? `<span class="pill ${a.status === "active" ? "" : "off"}">${esc(a.status)}</span>` : "—"}</td>
      </tr>`).join("");
  return `<table><thead><tr><th>#</th><th>광고주</th><th>Library ID</th><th class="num">게재기간</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function advertisersSection(t) {
  if (!t.advertisers || !t.advertisers.length) return `<p class="empty">광고주명이 캡처된 광고가 없어 변형 집계를 산출할 수 없습니다.</p>`;
  const rows = t.advertisers.map((v) => `
      <tr>
        <td>${esc(v.advertiser_name)}</td>
        <td class="num">${esc(v.variation_count)}종</td>
        <td>${v.platform_mix && v.platform_mix.length ? v.platform_mix.map(esc).join(", ") : "—"}</td>
      </tr>`).join("");
  return `<table><thead><tr><th>광고주</th><th class="num">변형 수</th><th>플랫폼</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function changeSection(t) {
  // present ONLY with ≥2 dated snapshots; otherwise an explicit not-yet-observable note (no fabricated rows).
  const hasChange = Array.isArray(t.new_since_last) || Array.isArray(t.disappeared_since_last);
  if (!hasChange) {
    return `<p class="empty">단일 스냅샷이라 신규/중단/속도는 아직 관측할 수 없습니다 — 주기적으로 재수집하면 누적됩니다.</p>`;
  }
  const list = (ids) => (ids && ids.length ? ids.map(esc).join(", ") : "<span class=\"empty\">없음</span>");
  const cadence = typeof t.cadence_new_ads_per_week === "number" ? `<p class="note">신규 게재 속도: 주당 약 <b>${esc(t.cadence_new_ads_per_week)}</b>종</p>` : "";
  return `
      <p><b>신규</b> (직전 수집 대비 새로 등장): ${list(t.new_since_last)}</p>
      <p><b>중단</b> (직전엔 있었으나 사라짐 = 꺼졌거나 종료): ${list(t.disappeared_since_last)}</p>
      ${cadence}`;
}

function flagsSection(t) {
  if (!t.coverage_flags || !t.coverage_flags.length) return `<p class="note">보고된 갭 없음.</p>`;
  return `<ul class="flags">${t.coverage_flags.map((f) => `<li>⚠ ${esc(f)}</li>`).join("")}</ul>`;
}

function metaLine(t) {
  const dated = typeof t.dated_snapshot_count === "number" ? ` (날짜확인 ${esc(t.dated_snapshot_count)}개)` : "";
  return `페르소나: <b>${esc(t.persona_id ?? "—")}</b> · 스냅샷 ${esc(t.snapshot_count)}개${dated} · 추적 광고 ${esc(t.tracked_ads)}개 · 수집 크리에이티브 ${esc(t.total_creatives)}개`;
}

export function renderReport(trend, template) {
  const synthesis = trend.synthesis
    ? esc(trend.synthesis) + (trend.confidence_note ? `\n\n<span class="note">${esc(trend.confidence_note)}</span>` : "")
    : `<span class="empty">서술(synthesis)이 아직 작성되지 않았습니다 — competitive-analyst 실행 후 채워집니다.</span>`;
  const footer = `생성: ${esc(trend.generated_at ?? "—")}${trend.today ? ` · 기준일 ${esc(trend.today)}` : ""}. 게재기간은 성과의 대리 신호이며 메타가 제공하는 실제 성과 지표가 아닙니다.`;
  // Function replacements — a string value with $&, $$, $`, $' would be parsed as a special replacement pattern
  // (advertiser names / synthesis are arbitrary text; esc() does not neutralize `$`). A function disables that.
  return template
    .replace("<!--META-->", () => metaLine(trend))
    .replace("<!--SYNTHESIS-->", () => synthesis)
    .replace("<!--LONGEVITY-->", () => longevitySection(trend))
    .replace("<!--ADVERTISERS-->", () => advertisersSection(trend))
    .replace("<!--CHANGE-->", () => changeSection(trend))
    .replace("<!--FLAGS-->", () => flagsSection(trend))
    .replace("<!--FOOTER-->", () => footer);
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const trendPath = process.argv[2];
  if (!trendPath) { console.error("Usage: node shared/harness/render-report.mjs <competitive-trend.json> [out.html]"); process.exit(2); }
  const trend = JSON.parse(readFileSync(trendPath, "utf8"));
  const template = readFileSync(TEMPLATE, "utf8");
  const outPath = process.argv[3] ?? resolve(dirname(trendPath), "competitive-report.html");
  const html = renderReport(trend, template);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
  console.log(`SAVED competitive-report → ${outPath}`);
}
