// Schema build: each schemas/<stage>/<name>.ts is the SINGLE SOURCE (TypeBox). This emits, per source:
//   ① <name>.schema.json  — validator-facing JSON Schema (machine; shared/_lib.ts loads it by basename)
//   ② <name>.view.md      — agent-facing terse typed-view (lean; what an agent @-imports)
//   ③ <name>.<consumer>.view.md — per-consumer axis projection, when the source exports `projections`
// Source contract:  export const name: string;  export const schema: TSchema;  export const projections?: Record<string, Record<string,string[]|"*">>
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCHEMAS = dirname(fileURLToPath(import.meta.url));

// ---- typed-view renderer (terse TS-like contract with inline intent comments) ----
function tsType(node: any, indent: string): string {
  // union (literals → "a"|"b"; types incl. null → string|null)
  const u = node.anyOf ?? node.oneOf;
  if (Array.isArray(u)) return u.map((x: any) => ("const" in x ? JSON.stringify(x.const) : tsType(x, indent))).join("|");
  if (node.type === "null") return "null";
  if (node.type === "array") {
    const item = tsType(node.items, indent);
    return /[|]/.test(item) && !item.startsWith("{") ? `(${item})[]` : `${item}[]`;
  }
  if (node.type === "object") return renderObject(node, indent);
  if (node.type === "number" || node.type === "integer") return `${node.type === "integer" ? "int" : "number"}${node.minimum !== undefined || node.maximum !== undefined ? ` /*${node.minimum ?? ""}..${node.maximum ?? ""}*/` : ""}`;
  if (node.type === "boolean") return "boolean";
  return "string";
}
// surface validation constraints the model needs to FILL correctly (non-empty, min items) into the comment.
function constraintNote(v: any): string[] {
  const c: string[] = [];
  if (v.type === "string" && v.minLength) c.push("non-empty");
  if (v.type === "array" && v.minItems) c.push(`≥${v.minItems} item${v.minItems > 1 ? "s" : ""}`);
  return c;
}
function renderObject(node: any, indent: string): string {
  const req = new Set<string>(node.required ?? []);
  const inner = indent + "  ";
  const lines = Object.entries(node.properties ?? {}).map(([k, v]: [string, any]) => {
    const note = [...constraintNote(v), v.description].filter(Boolean).join("; ");
    return `${inner}${k}${req.has(k) ? "" : "?"}: ${tsType(v, inner)}${note ? `  // ${note}` : ""}`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}
function viewMd(node: any, title: string): string {
  const head = node.description ? `// ${node.description}\n` : "";
  return `<!-- GENERATED from ${title}.ts — the contract your output must match; regenerate via schemas/build.ts -->\n\`\`\`ts\n${head}${title} = ${renderObject(node, "")}\n\`\`\`\n`;
}

// ---- consumer projection (field-level: pick sub-fields, carry join keys) ----
const KEYS = ["image_ref", "persona_id", "product_id", "competitor_id", "run_id"];
function pick(node: any, sub: string[] | "*"): any {
  if (sub === "*" || node.type !== "object") return node;
  const props: any = {};
  for (const k of sub) if (node.properties[k]) props[k] = node.properties[k];
  return { ...node, properties: props, required: (node.required ?? []).filter((r: string) => props[r]) };
}
function project(schema: any, spec: Record<string, string[] | "*">, title: string): any {
  const props: any = {};
  for (const k of KEYS) if (schema.properties[k]) props[k] = schema.properties[k];
  for (const [f, sub] of Object.entries(spec)) {
    if (!schema.properties[f]) continue;
    props[f] = schema.properties[f].type === "array" && sub !== "*" ? { ...schema.properties[f], items: pick(schema.properties[f].items, sub) } : pick(schema.properties[f], sub);
  }
  return { type: "object", title, properties: props, required: (schema.required ?? []).filter((r: string) => props[r]) };
}

// ---- walk sources ----
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (e.endsWith(".ts") && e !== "build.ts") out.push(p);
  }
  return out;
}

const onlyArg = process.argv[2]; // optional: build a single source by name
let emitted = 0;
for (const srcPath of sources(SCHEMAS)) {
  const mod: any = await import(pathToFileURL(srcPath).href);
  if (!mod.name || !mod.schema) continue; // not a schema source
  if (onlyArg && mod.name !== onlyArg) continue;
  const dir = dirname(srcPath);
  const w = (f: string, s: string) => writeFileSync(resolve(dir, f), s.endsWith("\n") ? s : s + "\n");
  w(`${mod.name}.schema.json`, JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...mod.schema }, null, 2));
  w(`${mod.name}.view.md`, viewMd(mod.schema, mod.name));
  for (const [key, spec] of Object.entries((mod.projections ?? {}) as Record<string, any>)) {
    w(`${mod.name}.${key}.view.md`, viewMd(project(mod.schema, spec, key), key));
  }
  emitted++;
  console.log(`  ${mod.name}: schema.json + view.md${mod.projections ? ` + ${Object.keys(mod.projections).length} projections` : ""}`);
}
console.log(`emitted ${emitted} schema source(s)`);
