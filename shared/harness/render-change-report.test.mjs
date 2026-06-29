import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { renderChangeReport } from "./render-change-report.mjs";
import { validateAgainst } from "../collect/schema-validate.mjs";

const RENDER = resolve("shared/harness/render-change-report.mjs");

test("renderChangeReport separates computed, interpreted, inferred, and escapes dynamic content", () => {
  const report = {
    persona_id: "p<script>",
    snapshot_range: { from_snapshot_id: "a", to_snapshot_id: "b" },
    confirmed_changes: [{ claim_kind: "computed", summary: "price decreased" }],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "proof-oriented shift" }],
    inferred_hypotheses: [{ claim_kind: "inferred", summary: "<img src=x onerror=alert(1)> season overlap" }],
    coverage_flags: ["no causal claim"],
    synthesis: "요약",
  };
  const validation = validateAgainst("creative-change-report.schema.json", report);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  const html = renderChangeReport(report);

  assert.match(html, /계산된 변화/);
  assert.match(html, /해석된 변화/);
  assert.match(html, /유추 가설/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test("render-change-report CLI validates input and renders populated list sections", () => {
  const dir = mkdtempSync(join(tmpdir(), "gai-render-change-report-"));
  const inPath = join(dir, "creative-change-report.json");
  const outPath = join(dir, "creative-change-report.html");
  writeFileSync(inPath, JSON.stringify({
    persona_id: "p",
    snapshot_range: { from_snapshot_id: "a", to_snapshot_id: "b" },
    confirmed_changes: [
      { claim_kind: "computed", summary: "inventory changed" },
      { claim_kind: "computed", summary: "appeal share changed" },
    ],
    classified_interpretations: [{ claim_kind: "interpreted", summary: "proof-oriented read" }],
    inferred_hypotheses: [],
    coverage_flags: ["context not supplied"],
    synthesis: "요약",
  }, null, 2));

  execFileSync("node", [RENDER, inPath, outPath], { encoding: "utf8" });
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /inventory changed/);
  assert.match(html, /appeal share changed/);
  assert.match(html, /proof-oriented read/);
  assert.match(html, /context not supplied/);
});
