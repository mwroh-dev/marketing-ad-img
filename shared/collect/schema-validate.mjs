// Small ESM validation helper for .mjs harnesses. Mirrors shared/_lib.ts schema lookup without importing TS.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const cache = new Map();
let schemaIndex = null;

function buildIndex() {
  const idx = new Map();
  for (const rel of readdirSync(resolve(ROOT, "schemas"), { recursive: true })) {
    if (typeof rel === "string" && rel.endsWith(".schema.json")) idx.set(rel.split("/").pop(), resolve(ROOT, "schemas", rel));
  }
  return idx;
}

export function validateAgainst(schemaFile, data) {
  schemaIndex ||= buildIndex();
  let validate = cache.get(schemaFile);
  if (!validate) {
    const schemaPath = schemaIndex.get(schemaFile);
    if (!schemaPath) throw new Error(`schema not found: ${schemaFile}`);
    validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
    cache.set(schemaFile, validate);
  }
  const ok = validate(data);
  return {
    ok,
    errors: ok ? [] : (validate.errors || []).map((e) => `${e.instancePath || "(root)"} ${e.message || ""}`.trim()),
  };
}

export function report(label, result) {
  if (result.ok) {
    console.log(`PASS  ${label}`);
    return true;
  }
  console.error(`FAIL  ${label}`);
  for (const e of result.errors) console.error(`        - ${e}`);
  return false;
}
