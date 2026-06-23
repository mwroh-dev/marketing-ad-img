import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { checkState } from "./check-state.mjs";

const TMP = join(tmpdir(), "gai-checkstate-test");   // os.tmpdir() — cross-platform (Windows has no /tmp)
const reset = () => rmSync(TMP, { recursive: true, force: true });
after(reset);   // guaranteed cleanup at suite end, even if the last test throws (no stray temp dir)

test("no state → setup_complete false → routes to initial-setup", () => {
  reset();
  const s = checkState(TMP);
  assert.equal(s.setup_complete, false);
  assert.equal(s.next, "initial-setup");
});

test("brand/product/persona present → setup_complete → routes to request-evaluation", () => {
  reset();
  const persona = resolve(TMP, "brands/acme/products/widget/personas");
  mkdirSync(persona, { recursive: true });
  writeFileSync(resolve(persona, "buyer.json"), "{}");
  const s = checkState(TMP);
  assert.equal(s.setup_complete, true);
  assert.match(s.next, /request-evaluation/);
  assert.equal(s.brands[0].brand_id, "acme");
  assert.equal(s.brands[0].products[0].personas[0].persona_id, "buyer");
  assert.equal(s.brands[0].products[0].personas[0].has_competitors, false);
});

test("persona without confirmed competitors is flagged in the route", () => {
  reset();
  mkdirSync(resolve(TMP, "brands/acme/products/widget/personas"), { recursive: true });
  writeFileSync(resolve(TMP, "brands/acme/products/widget/personas/buyer.json"), "{}");
  const s = checkState(TMP);
  assert.match(s.next, /no confirmed competitors/);
});

test("persona with competitors → clean ready route", () => {
  reset();
  const pd = resolve(TMP, "brands/acme/products/widget/personas/buyer");
  mkdirSync(resolve(pd, "competitors"), { recursive: true });
  writeFileSync(resolve(pd, "competitors", "competitors.json"), "{}");
  const s = checkState(TMP);
  const p0 = s.brands[0].products[0].personas[0];
  assert.equal(p0.has_competitors, true);
  assert.equal(s.next, "ready — request-evaluation");
});
