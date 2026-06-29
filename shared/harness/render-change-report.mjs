// Deterministic renderer for creative-change-report.json. No LLM-generated HTML.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst, report } from "../collect/schema-validate.mjs";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const list = (items = []) => items.length ? `<ul>${items.map((x) => `<li><span class="kind">${esc(x.claim_kind)}</span> ${esc(x.summary)}</li>`).join("")}</ul>` : `<p class="empty">not observed / not supplied</p>`;
const flags = (items = []) => items.length ? `<ul class="flags">${items.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="empty">reported gaps 없음</p>`;

export function renderChangeReport(report) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Creative Change Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #202124; }
    h1 { font-size: 24px; } h2 { font-size: 18px; margin-top: 28px; }
    .meta, .empty { color: #5f6368; } .kind { font-size: 12px; color: #5f6368; margin-right: 6px; }
    li { margin: 6px 0; } .flags li { color: #7a4b00; }
  </style>
</head>
<body>
  <h1>Creative Change Report</h1>
  <p class="meta">persona=${esc(report.persona_id)} · ${esc(report.snapshot_range?.from_snapshot_id)} → ${esc(report.snapshot_range?.to_snapshot_id)}</p>
  <h2>요약</h2>
  <p>${esc(report.synthesis || "서술 없음")}</p>
  <h2>계산된 변화</h2>
  ${list(report.confirmed_changes)}
  <h2>해석된 변화</h2>
  ${list(report.classified_interpretations)}
  <h2>유추 가설</h2>
  ${list(report.inferred_hypotheses)}
  <h2>Coverage Flags</h2>
  ${flags(report.coverage_flags)}
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
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderChangeReport(payload), "utf8");
  console.log(`SAVED creative-change-report → ${outPath}`);
}
