// SINGLE SOURCE for creative-candidate (TypeBox). Container for image-generation candidates (provider-neutral).
// image-prompt-adapter consumes `provider_neutral_spec`; critic-verifier reads candidates; CODE validates.
// The original used $defs/$ref; TypeBox inlines (validation-identical). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const FORMAT = ["meta_square_1_1", "meta_feed_4_5", "meta_story_9_16", "meta_landscape_1_91_1"];
const ANGLE = ["product_usp", "persona_response", "compelling_claim", "visual_hierarchy"];
const candidateId = () => Type.String({ pattern: "^candidate_[0-9]{3}$" });

const creativeCandidateSpec = Type.Object(
  {
    candidate_id: candidateId(),
    format: U(FORMAT),
    canvas: Type.Object({ ratio: Type.String(), width: Type.Integer({ minimum: 1 }), height: Type.Integer({ minimum: 1 }) }, opts),
    product: Type.Object({ asset_id: Type.String(), placement: Type.String(), scale: U(["small", "medium", "large"]) }, opts),
    copy: Type.Object({ language: Type.String(), headline: Type.String({ minLength: 1 }), subcopy: Type.Optional(Type.String()), cta: Type.String({ minLength: 1 }) }, opts),
    layout: Type.Object({ headline_position: Type.String(), product_position: Type.String(), cta_position: Type.String(), text_density: U(["low", "medium", "high"]) }, opts),
    style: Type.Object({ brand_mood: Type.String(), color_direction: Type.String(), avoid: Type.Optional(Type.Array(Type.String())) }, opts),
  },
  { ...opts, description: "the provider-neutral spec the image-prompt-adapter specializes into ChatGPT/Gemini prompts" },
);

const candidate = Type.Object(
  {
    candidate_id: candidateId(),
    angle: U(ANGLE),
    primary_variable: Type.Optional(Type.String()),
    format: U(FORMAT),
    provider_neutral_spec: creativeCandidateSpec,
    evidence_refs: Type.Optional(Type.Array(Type.String())),
    assumption_notes: Type.Optional(Type.Array(Type.String())),
    risk_notes: Type.Optional(Type.Array(Type.String())),
  },
  opts,
);

export const name = "creative-candidate";
export const schema = Type.Object(
  {
    run_id: Type.String({ minLength: 1 }),
    candidate_count: Type.Integer({ minimum: 1, maximum: 12 }),
    candidates: Type.Array(candidate, { minItems: 1, maxItems: 12 }),
  },
  { ...opts, $id: "https://marketing-img/schemas/creative-candidate.schema.json", title: "Creative candidates file", description: "container for image-generation creative candidates (provider-neutral)" },
);
