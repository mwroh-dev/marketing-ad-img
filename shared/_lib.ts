// Shared helpers for marketing-img harness/validation scripts.
// These are validation/harness utilities, NOT a mode CLI.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import addFormats from "ajv-formats";

// ROOT = the plugin itself (read-only assets: schemas/, knowledge/guidelines/, agents/).
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// STATE_DIR = the CONSUMER's runtime state (brand/competitors/collected-ads/runs), created in the
// consumer's working directory — NOT in the plugin. Never released; gitignored. Override with
// GEN_ADS_IMG_STATE for tests/custom locations.
export const STATE_DIR = resolve(process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));

export function loadJson<T = any>(p: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, p), "utf8")) as T;
}

export function writeJson(p: string, data: unknown): void {
  const abs = resolve(ROOT, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// Consumer-state I/O — resolves under STATE_DIR (.generate-ads-img/), not the plugin ROOT.
export function statePath(p: string): string {
  return resolve(STATE_DIR, p);
}
export function loadState<T = any>(p: string): T {
  return JSON.parse(readFileSync(statePath(p), "utf8")) as T;
}
export function writeState(p: string, data: unknown): void {
  const abs = statePath(p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv as any);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const compiledCache = new Map<string, ReturnType<typeof ajv.compile>>();

// Schemas are grouped by stage under schemas/<stage>/. Resolve by basename so callers
// keep passing "<name>.schema.json" regardless of which stage subdir holds it.
let schemaIndex: Map<string, string> | null = null;
function resolveSchemaPath(schemaFile: string): string {
  if (!schemaIndex) {
    schemaIndex = new Map();
    for (const rel of readdirSync(resolve(ROOT, "schemas"), { recursive: true }) as string[]) {
      if (typeof rel === "string" && rel.endsWith(".schema.json")) {
        schemaIndex.set(rel.split("/").pop()!, `schemas/${rel}`);
      }
    }
  }
  return schemaIndex.get(schemaFile) ?? `schemas/${schemaFile}`;
}

export function validateAgainst(schemaFile: string, data: unknown): ValidationResult {
  let validate = compiledCache.get(schemaFile);
  if (!validate) {
    validate = ajv.compile(loadJson(resolveSchemaPath(schemaFile)));
    compiledCache.set(schemaFile, validate);
  }
  const ok = validate(data) as boolean;
  const errors: string[] = ok
    ? []
    : (validate.errors ?? []).map((e: ErrorObject) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim());
  return { ok, errors };
}

export function report(label: string, r: ValidationResult): boolean {
  if (r.ok) {
    console.log(`PASS  ${label}`);
  } else {
    console.error(`FAIL  ${label}`);
    for (const e of r.errors) console.error(`        - ${e}`);
  }
  return r.ok;
}
