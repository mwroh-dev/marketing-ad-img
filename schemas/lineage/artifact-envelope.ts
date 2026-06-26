// SINGLE SOURCE for artifact-envelope (TypeBox). Lineage envelope wrapping ONE analysis/generation artifact in the
// global store. CODE-produced (persist-artifact). Parity gate.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals) => Type.Union(vals.map((v) => Type.Literal(v)));
export const name = "artifact-envelope";
export const schema = Type.Object(
  {
    kind: U(["perception", "copy", "layout", "visual", "intent", "strategy", "ad-type", "ad-type-gate", "bindings", "opportunity", "brief", "candidate"]),
    key: Type.Object(
      { persona_id: Type.String({ minLength: 1 }), image_ref: Type.Optional(Type.String({ description: "analysis — the ad's stable image join key" })), candidate_id: Type.Optional(Type.String({ description: "generation — the candidate id" })), run_id: Type.Optional(Type.String({ description: "provenance, NOT the directory key" })) },
      { ...opts, description: "identity (persona + image/candidate) + provenance (run)" },
    ),
    pattern_tag: Type.String({ minLength: 1, description: "shared pattern → peers. analysis: {ad_type}:{benefit}×{funnel}; generation: the opportunity position" }),
    derived_from: Type.Array(
      Type.Object({ kind: Type.String(), ref: Type.String({ minLength: 1, description: "store-relative path of the parent envelope" }) }, opts),
      { description: "the chain — parent envelopes this was built from (machine-resolvable)" },
    ),
    logic_version: Type.Object(
      { version: Type.String({ minLength: 1 }), method: U(["git", "content"]), dirty: Type.Optional(Type.Boolean({ description: "git only — uncommitted logic changes at stamp time" })) },
      { ...opts, description: "which version of the shared logic produced this (a change marks prior artifacts stale)" },
    ),
    produced_by: Type.String({ minLength: 1, description: "the agent or script that emitted the payload" }),
    stamped_at: Type.String({ minLength: 1, description: "ISO timestamp when persisted" }),
    payload: Type.Object({}, { additionalProperties: true, description: "the artifact itself — conforms to its own schema" }),
  },
  { ...opts, $id: "https://marketing-img/schemas/artifact-envelope.schema.json", title: "ArtifactEnvelope", description: "lineage envelope: chain + pattern_tag + logic_version stamping ONE stored artifact" },
);
