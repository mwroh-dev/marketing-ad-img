// SINGLE SOURCE for ad-type (TypeBox). The ad-type-classifier's output for ONE ad (text-only, ring 2).
// Consumed by CODE (ad-type-gate, validators) — the only agent reader is the producer. Lean descriptions =
// fill-signal; the taxonomy/grounds_in discipline lives in ad-type-classifier.md + ad-taxonomy.md.
import { Type } from "@sinclair/typebox";

const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const EXEC = ["straight_sell", "scientific_evidence", "demonstration", "comparison", "testimonial", "slice_of_life", "lifestyle", "mood_image", "fantasy", "personality_symbol", "dramatization", "humor", "animation", "musical", "other"];

export const name = "ad-type";
export const schema = Type.Object(
  {
    image_ref: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    message_basis: U(["informational", "transformational", "hybrid", "other"], { description: "layer 1 — what carries the message (Puto & Wells 1984)" }),
    execution_style: U(EXEC, { description: "layer 2 — observable execution style (Belch & Belch; Kotler & Armstrong)" }),
    secondary_execution_styles: Type.Optional(Type.Array(U(EXEC))),
    ad_type: U(["informational", "transformational", "social_proof", "default"], { description: "the routed seed adapter (ad-taxonomy.md routing table)" }),
    grounds_in: Type.String({ minLength: 1, description: "REQUIRED provenance — the ad-taxonomy.md citation(s) this rests on; a classification with no basis is a defect" }),
    reason: Type.Optional(Type.String({ description: "which perception facts drove the call (anti-hallucination trace)" })),
    confidence: Type.Optional(U(["high", "medium", "low"])),
  },
  { ...opts, $id: "https://marketing-img/schemas/ad-type.schema.json", title: "AdType", description: "the ad-type classification for ONE ad (text-only, ring 2), with grounds_in provenance" },
);
