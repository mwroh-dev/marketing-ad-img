// generation finalizer / validator-wiring — sources the REAL upstream agent outputs (no phantom bundle).
//
// INPUTS (what the agents actually produce, joined by candidate ORDER):
//   --copy    <copy-layout.json>      (schema copy-layout)        per-candidate angle + Korean copy + layout
//   --chatgpt <generated-prompts/chatgpt.json> (schema image-adapter-output)  per-candidate ChatGPT adapter output
//   --gemini  <generated-prompts/gemini.json>  (schema image-adapter-output)  per-candidate Gemini adapter output
// OUTPUTS (drop-in for validate-candidate.ts):
//   <out>                              creative-candidates.json   (schema creative-candidate; normalized spec, NO inline adapter outputs)
//   <out dir>/candidate-selection-log.json   (schema candidate-selection-log)
//   + an asset-registry sync in .generate-ads-img/registry/product-assets.yaml
// The generated-prompts/{chatgpt,gemini}.json already exist (the adapter wrote them) — they are NOT re-emitted.
// Deterministic wiring — no LLM, no provider call.
//
// Usage:
//   tsx shared/harness/finalize-candidates.ts --copy <copy-layout.json> --chatgpt <chatgpt.json> --gemini <gemini.json>
//        --out <creative-candidates.json> [--persona persona_x] [--strict]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const strict = argv.includes("--strict");
const copyPath = flag("copy");
const chatgptPath = flag("chatgpt");
const geminiPath = flag("gemini");
const outPath = flag("out") ? resolve(flag("out")!) : undefined;
if (!copyPath || !chatgptPath || !geminiPath || !outPath) {
  console.error("Usage: tsx shared/harness/finalize-candidates.ts --copy <copy-layout.json> --chatgpt <chatgpt.json> --gemini <gemini.json> --out <creative-candidates.json> [--persona id] [--strict]");
  process.exit(2);
}
const STATE_DIR = resolve(process.env.GEN_ADS_IMG_STATE ?? resolve(process.cwd(), ".generate-ads-img"));
const REGISTRY = resolve(STATE_DIR, "registry/product-assets.yaml");

const RATIO_TO_FORMAT: Record<string, string> = { "1:1": "meta_square_1_1", "4:5": "meta_feed_4_5", "9:16": "meta_story_9_16", "1.91:1": "meta_landscape_1_91_1" };
const DENSITY = new Set(["low", "medium", "high"]);
const SCALE = new Set(["small", "medium", "large"]);

const copyDoc = JSON.parse(readFileSync(resolve(copyPath), "utf8"));
const cgDoc = JSON.parse(readFileSync(resolve(chatgptPath), "utf8"));
const gmDoc = JSON.parse(readFileSync(resolve(geminiPath), "utf8"));
const copyCands: any[] = copyDoc.candidates ?? [];
const cgOut: any[] = cgDoc.outputs ?? [];
const gmOut: any[] = gmDoc.outputs ?? [];
const runId = cgDoc.run_id ?? copyDoc.run_id ?? "finalized";
const personaId = flag("persona") ?? copyDoc.persona_id ?? "persona";

if (copyCands.length !== cgOut.length || copyCands.length !== gmOut.length) {
  console.error(`FAIL  candidate-count mismatch: copy=${copyCands.length} chatgpt=${cgOut.length} gemini=${gmOut.length}`);
  process.exit(1);
}

const creativeDir = dirname(outPath);

// ---- asset registry sync ----------------------------------------------------
const assetIds = new Set<string>();
for (const cg of cgOut) for (const a of cg.input_assets ?? []) assetIds.add(a.asset_id);
const registryText = existsSync(REGISTRY) ? readFileSync(REGISTRY, "utf8") : "product_assets:\n";
const synced: string[] = [];
const present: string[] = [];
let newRegistry = registryText;
for (const id of assetIds) {
  // plain substring match on the controlled YAML format — avoids RegExp injection/ReDoS from `id`
  if (registryText.includes(`asset_id: ${id}\n`) || registryText.includes(`asset_id: ${id} `)) { present.push(id); continue; }
  if (strict) { console.error(`FAIL  asset '${id}' not in registry (strict)`); process.exit(1); }
  const productId = id.replace(/_(main|\d+)$/, "");
  const assetPath = cgOut.flatMap((c: any) => c.input_assets ?? []).find((a: any) => a.asset_id === id)?.path ?? `assets/product-images/raw/${id}.png`;
  newRegistry += `  - asset_id: ${id}\n    product_id: ${productId}\n    raw_image_path: "${assetPath}"\n    cutout_path: ""\n    preview_path: ""\n    mask_path: ""\n    cutout_status: pending\n    cleanup_report_ref: ""\n`;
  synced.push(id);
}
if (synced.length) { mkdirSync(dirname(REGISTRY), { recursive: true }); writeFileSync(REGISTRY, newRegistry, "utf8"); for (const id of synced) console.log(`SYNCED asset '${id}' (authorized)`); }
for (const id of present) console.log(`OK     asset '${id}' already in registry`);

const productIdOf = (assetId?: string) => (assetId ?? "product").replace(/_(main|\d+)$/, "");

// ---- normalize candidates (join copy ⋈ adapter by order) ---------------------
const normCandidates: any[] = [];
const selectionEntries: any[] = [];

for (let i = 0; i < copyCands.length; i++) {
  const c = copyCands[i];
  const cg = cgOut[i];
  const gm = gmOut[i];
  const candidateId = cg.candidate_id ?? gm.candidate_id ?? `candidate_${String(i + 1).padStart(3, "0")}`;
  const ratio: string = cg.expected_output?.ratio ?? "4:5";
  const format = c.format ?? RATIO_TO_FORMAT[ratio] ?? "meta_feed_4_5";
  const assetId = cg.input_assets?.[0]?.asset_id;
  const lay = c.layout ?? {};
  const density = DENSITY.has(lay.text_density) ? lay.text_density : "medium";
  const scale = SCALE.has(lay.product_scale) ? lay.product_scale : (c.angle === "visual_hierarchy" ? "large" : "medium");

  const copy: any = { language: "ko", headline: c.headline, cta: c.cta };
  if (c.subcopy) copy.subcopy = c.subcopy;

  normCandidates.push({
    candidate_id: candidateId,
    angle: c.angle,
    primary_variable: c.primary_variable ?? c.angle,
    format,
    provider_neutral_spec: {
      candidate_id: candidateId,
      format,
      canvas: { ratio, width: cg.expected_output?.width ?? 1080, height: cg.expected_output?.height ?? 1350 },
      product: { asset_id: assetId, placement: lay.product_position ?? "center", scale },
      copy,
      layout: {
        headline_position: lay.headline_position ?? "top-center",
        product_position: lay.product_position ?? "center",
        cta_position: lay.cta_position ?? "bottom-center",
        text_density: density,
      },
      style: { brand_mood: copyDoc.style?.brand_tone ?? "neutral", color_direction: "neutral", avoid: copyDoc.style?.avoid ?? [] },
    },
    evidence_refs: c.evidence_refs ?? [],
    risk_notes: c.risk_notes ?? [],
  });

  selectionEntries.push({
    candidate_id: candidateId,
    angle: c.angle,
    primary_variable: c.primary_variable ?? c.angle,
    product_id: productIdOf(assetId),
    persona_id: personaId,
    format,
    adapter: ["chatgpt_image", "gemini_image"],
    reason: c.rationale ?? lay.composition ?? `${c.angle} angle`,
  });
}

const creativeCandidates = { run_id: runId, candidate_count: normCandidates.length, candidates: normCandidates };
const selectionLog = { run_id: runId, candidate_count: selectionEntries.length, selection_strategy: copyDoc.selection_strategy ?? "diversified_by_angle", candidates: selectionEntries };

function write(p: string, data: unknown) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8"); console.log(`WROTE  ${p}`); }
write(outPath, creativeCandidates);
write(resolve(creativeDir, "candidate-selection-log.json"), selectionLog);
console.log(`\nfinalize-candidates: ${normCandidates.length} candidates → creative-candidates.json + candidate-selection-log.json. run_id=${runId}`);
