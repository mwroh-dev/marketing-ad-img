// SINGLE SOURCE for ad-pattern (TypeBox). L3 per-persona aggregated pattern — CODE-computed (ad-pattern-rank),
// with `synthesis` added by pattern-synthesizer. Consumed by the generation pipeline (creative-brief). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const topK = (description?: string) =>
  Type.Array(Type.Object({ value: Type.String(), freq: Type.Number(), score: Type.Number() }, opts), description ? { description } : {});

export const name = "ad-pattern";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    image_count: Type.Integer({ minimum: 0 }),
    composition_top_k: topK(),
    text_role_distribution: Type.Record(Type.String(), Type.Number(), { description: "role → share map" }),
    hook_top_k: Type.Optional(topK()),
    copy_keywords_top_k: Type.Optional(topK()),
    medium_top_k: Type.Optional(topK("axis 3 — rendering medium distribution (from visual analyses)")),
    setting_top_k: Type.Optional(topK("axis 3 — scene setting distribution")),
    register_top_k: Type.Optional(topK("axis 4 — named visual register/mood distribution")),
    appeal_top_k: Type.Optional(topK("axis 5 — persuasion appeal distribution (the transferable strategy layer)")),
    funnel_stage_top_k: Type.Optional(topK("axis 5 — funnel stage distribution")),
    comfort: Type.Object({ avg_crowding: Type.Number(), avg_whitespace: Type.Number(), awkward_rate: Type.Number() }, opts),
    synthesis: Type.Optional(Type.String({ description: "interpretive narrative added by pattern-synthesizer ON TOP (recomputes nothing)" })),
    generated_at: Type.Optional(Type.String()),
    confidence_note: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/ad-pattern.schema.json", title: "AdPattern", description: "per-persona aggregated ad composition + strategy pattern (deterministic top-k + synthesis)" },
);

// competitive-analyst narrates only the corpus appeals (copy_keywords/hook); pattern-synthesizer + creative-brief
// read the full pattern.
export const projections: Record<string, Record<string, string[] | "*">> = {
  // narrates corpus appeals — keywords/hooks + appeal axis, anchored to corpus size
  "competitive-analyst": { image_count: "*", copy_keywords_top_k: "*", hook_top_k: "*", appeal_top_k: "*" },
};
