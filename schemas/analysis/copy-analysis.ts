// SINGLE SOURCE for copy-analysis (TypeBox). Emits copy-analysis.schema.json + copy-analysis.view.md.
// L2b — text-role + hook + keywords from L1 text content only. No projections (intent-analyst + pattern-synthesizer
// both read the whole artifact). Lean descriptions = fill-signal only; method/discipline lives in copy-analyst.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const CopyElement = Type.Object(
  {
    content: Type.String({ description: "verbatim from the perception text element it came from" }),
    source_id: Type.Optional(Type.String({ description: "the perception text element id (t#) this came from — makes the role traceable without the image; omit only if no single element maps" })),
    text_role: U(["headline", "subcopy", "CTA", "badge", "price", "review_quote", "spec_label", "other"], { description: "what the line DOES (function), not a keyword match" }),
    hook_type: Type.Optional(U(["question", "contrast", "result", "empathy", "number", "other"], { description: "rhetorical function of a hook-bearing line; off/other on badge/price/spec/cta" })),
    confidence: Type.Optional(U(["high", "medium", "low"])),
  },
  opts,
);

export const name = "copy-analysis";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    copy_elements: Type.Array(CopyElement),
    sentence_patterns: Type.Optional(Type.String({ description: "recurring sentence STRUCTURE (imperative/declarative mix, question framing, number+unit cadence…), NOT a paraphrase of content" })),
    keywords: Type.Optional(Type.Array(Type.String(), { description: "meaning-bearing surface forms verbatim (no score/rank — the deterministic script ranks)" })),
  },
  { ...opts, $id: "https://marketing-img/schemas/copy-analysis.schema.json", title: "CopyAnalysis", description: "text-role + hook + keywords, from L1 text content only" },
);

// consumers (intent-analyst, pattern-synthesizer) read roles/hooks/keywords — NOT source_id (producer-only
// traceability handle). Producer (copy-analyst) reads the full view.
export const projections: Record<string, Record<string, string[] | "*">> = {
  consumer: { copy_elements: ["content", "text_role", "hook_type", "confidence"], sentence_patterns: "*", keywords: "*" },
};

