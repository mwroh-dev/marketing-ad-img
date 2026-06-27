import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const TSX = resolve("node_modules/.bin/tsx");
const GATE = resolve("shared/harness/validate-store.ts");
const TMP = join(tmpdir(), "gai-validate-store-test");
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);

// a complete lineage envelope (artifact-envelope.schema.json)
const ENV = {
  kind: "perception", key: { persona_id: "p" }, pattern_tag: "default:function×discovery",
  derived_from: [], logic_version: { version: "v1", method: "content" },
  produced_by: "perception-extractor", stamped_at: "2026-06-27T00:00:00.000Z", payload: { image_ref: "x" },
};

function run() {
  try { return { code: 0, out: execFileSync(TSX, [GATE, "p", join(TMP, ".generate-ads-img")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
}
function write(rel, obj) { const fp = join(TMP, ".generate-ads-img", "store", "p", rel); mkdirSync(resolve(fp, ".."), { recursive: true }); writeFileSync(fp, JSON.stringify(obj)); }

test("complete envelopes → STORE PASS, exit 0", () => {
  reset(); write("ad-0/perception.json", ENV);
  const r = run(); assert.equal(r.code, 0, r.out); assert.match(r.out, /STORE PASS/);
});

test("a raw analyst payload in the store (improvised) → STORE FAIL, exit 1", () => {
  reset();
  write("ad-0/perception.json", ENV);
  write("ad-0/strategy.json", { image_ref: "x", persona_id: "p", benefit_vector: { primary: "function" } }); // raw, no envelope
  const r = run(); assert.equal(r.code, 1, r.out); assert.match(r.out, /STORE FAIL/);
});

test("a partial envelope missing provenance (logic_version) → FAIL", () => {
  reset();
  const partial = { ...ENV }; delete partial.logic_version;
  write("ad-0/perception.json", partial);
  assert.equal(run().code, 1);
});

test("no store for persona → exit 1", () => { reset(); mkdirSync(TMP, { recursive: true }); assert.equal(run().code, 1); });
