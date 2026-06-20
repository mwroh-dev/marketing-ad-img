// Image refiner gate — pure helpers + guarded CLI. Classifies are produced by the
// ad-creative-refiner vision agent; this gate filters to ad_creative, caps, and emits the
// knowledge/guidelines/ad-source-adapter-contract ad-creative.json (source=own_detail_cut) for ad analysis drop-in. No network.
import { fileURLToPath } from "url";
import { resolve } from "path";
import { safeName } from "./ad-source-helpers.mjs";

export function keepAdCreatives(classifications, { minConfidence = 0.6, cap = 24 } = {}) {
  return (classifications || [])
    .map((c, i) => ({ ...c, _i: i }))
    .filter((c) => c.type === "ad_creative" && (c.confidence ?? 0) >= minConfidence)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0) || a._i - b._i)
    .slice(0, cap)
    .map(({ _i, ...rest }) => rest);
}

export function typeDistribution(classifications) {
  const d = {};
  for (const c of classifications || []) d[c.type] = (d[c.type] || 0) + 1;
  return d;
}

export function toAdCreativeJson({ personaId, kept }) {
  return {
    persona_id: personaId,
    source: "own_detail_cut",
    search: { mode: "detail_cut", query: "", category: "all_ads", country: "KR" },
    creatives: (kept || []).map((k, i) => ({
      image_url: k.image_ref,
      image_file: `images/ad-${i}.jpg`,
      subtype: "single_image",
      type: "ad_creative",
      confidence: k.confidence,
      competitor_id: k.competitor_id,
    })),
    coverage_flags: [],
    blocked: false,
    captured_at: "refined-from-detail-cut",
  };
}

// --- CLI (runs only when invoked directly, not on import) ---
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const { readFileSync, writeFileSync, mkdirSync, copyFileSync } = await import("fs");
  const argVal = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
  const positional = process.argv.slice(2).filter((a, i, arr) => !a.startsWith("--") && arr[i - 1] !== "--classifications" && arr[i - 1] !== "--competitors" && arr[i - 1] !== "--min-conf" && arr[i - 1] !== "--cap");
  const [personaId, runId = "refined"] = positional;
  if (!personaId || !argVal("--classifications")) {
    console.error("Usage: node refine-images.mjs <personaId> [runId] --classifications <path.json> [--min-conf 0.6] [--cap 24]");
    process.exit(1);
  }
  safeName(personaId, "personaId"); safeName(runId, "runId");
  const parsed = JSON.parse(readFileSync(argVal("--classifications"), "utf8"));
  const classifications = Array.isArray(parsed) ? parsed : [];
  if (!Array.isArray(parsed)) console.error("warning: --classifications is not an array; treating as empty");
  const minConfidence = argVal("--min-conf") !== null ? Number(argVal("--min-conf")) : 0.6;
  const cap = argVal("--cap") !== null ? Number(argVal("--cap")) : 24;

  const kept = keepAdCreatives(classifications, { minConfidence, cap });
  const result = toAdCreativeJson({ personaId, kept });

  const outDir = `.generate-ads-img/runs/${runId}/ad-creatives/${personaId}`;
  const imgDir = `${outDir}/images`;
  mkdirSync(imgDir, { recursive: true });
  // copy kept source images → standardized images/ad-N.jpg so ad analysis's relative image_file works.
  // image_ref comes from an LLM vision agent's output — confine it to the project tree so a crafted
  // ref (e.g. /etc/passwd, ~/.ssh/id_rsa) can't be copied into the collection manifest.
  const projectBase = resolve(process.cwd());
  result.creatives.forEach((cr, i) => {
    const src = resolve(kept[i].image_ref ?? "");
    if (src !== projectBase && !src.startsWith(projectBase + "/")) {
      result.coverage_flags.push(`BLOCKED out-of-tree image_ref: ${kept[i].image_ref}`);
      return;
    }
    try { copyFileSync(src, `${imgDir}/ad-${i}.jpg`); }
    catch (e) { result.coverage_flags.push(`copy-failed: ${kept[i].image_ref} (${e.message})`); }
  });
  result.coverage_flags.push(`type_distribution: ${JSON.stringify(typeDistribution(classifications))}`);

  writeFileSync(`${outDir}/ad-creative.json`, JSON.stringify(result, null, 2) + "\n");
  writeFileSync(`${outDir}/refiner-report.json`, JSON.stringify({
    persona_id: personaId, total: classifications.length,
    type_distribution: typeDistribution(classifications),
    kept: kept.length, min_confidence: minConfidence, cap,
    classifications,
  }, null, 2) + "\n");
  console.log(`REFINED ${kept.length}/${classifications.length} ad_creative (dist ${JSON.stringify(typeDistribution(classifications))}) → ${outDir}/ad-creative.json`);
}
