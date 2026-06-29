import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSubagentProjection } from "./subagent-projection-guard.mjs";

test("projection guard allows the vision-owning agents to receive one raw media input", () => {
  const result = validateSubagentProjection("perception-extractor", {
    persona_id: "p1",
    image_path: "/tmp/live/ad-0.jpg",
    output_contract: "perception.schema.json",
  }, { persona_id: "p1" });

  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("projection guard rejects raw media and browser artifacts for downstream analysis agents", () => {
  const media = validateSubagentProjection("copy-analyst", {
    persona_id: "p1",
    perception_artifact: ".generate-ads-img/store/p1/ad-0/perception.json",
    image_path: "/tmp/live/ad-0.jpg",
  }, { persona_id: "p1" });

  assert.equal(media.ok, false);
  assert.match(media.errors.join("\n"), /raw media/i);

  const browser = validateSubagentProjection("temporal-change-analyst", {
    persona_id: "p1",
    input_artifacts: ["creative-diff.json", "change-candidates.json"],
    full_browser_logs: ["Network.requestWillBeSent ..."],
  }, { persona_id: "p1" });

  assert.equal(browser.ok, false);
  assert.match(browser.errors.join("\n"), /browser/i);
});

test("projection guard allows artifact identity image_ref values but rejects direct image inputs", () => {
  const ok = validateSubagentProjection("temporal-change-analyst", {
    persona_id: "p1",
    creative_diff_excerpt: {
      inventory_delta: {
        created: [{ library_id: "L4", image_ref: "runs/run-b/ad-creatives/p1/images/ad-2.jpg" }],
      },
    },
  }, { persona_id: "p1" });

  assert.equal(ok.ok, true, ok.errors.join("\n"));

  const bad = validateSubagentProjection("temporal-change-analyst", {
    persona_id: "p1",
    raw_images: ["runs/run-b/ad-creatives/p1/images/ad-2.jpg"],
  }, { persona_id: "p1" });

  assert.equal(bad.ok, false);
  assert.match(bad.errors.join("\n"), /raw media/i);
});

test("projection guard blocks forbidden creative-change artifacts from market-context-researcher", () => {
  const result = validateSubagentProjection("market-context-researcher", {
    persona_id: "p1",
    target_market: "KR",
    input_artifacts: ["context-calendar.json", "creative-diff.json"],
  }, { persona_id: "p1" });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /creative-diff\.json/);
});

test("projection guard rejects other persona scope when a persona is declared", () => {
  const result = validateSubagentProjection("temporal-change-analyst", {
    persona_id: "p1",
    related_personas: [{ persona_id: "p2", note: "leaked peer corpus" }],
  }, { persona_id: "p1" });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /other persona/i);
});

test("projection guard CLI validates materialized handoff JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "projection-guard-"));
  const good = join(dir, "good.json");
  const bad = join(dir, "bad.json");
  writeFileSync(good, JSON.stringify({ persona_id: "p1", input_artifacts: ["creative-diff.json"] }), "utf8");
  writeFileSync(bad, JSON.stringify({ persona_id: "p1", image_path: "/tmp/ad-0.jpg" }), "utf8");

  const pass = execFileSync("node", ["shared/harness/validate-subagent-projection.mjs", "temporal-change-analyst", good, "--persona", "p1"], { encoding: "utf8" });
  assert.match(pass, /PASS subagent projection temporal-change-analyst/);

  const fail = spawnSync("node", ["shared/harness/validate-subagent-projection.mjs", "temporal-change-analyst", bad, "--persona", "p1"], { encoding: "utf8" });
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /raw media/);
});
