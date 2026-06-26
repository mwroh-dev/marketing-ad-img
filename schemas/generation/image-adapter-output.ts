// SINGLE SOURCE for image-adapter-output (TypeBox). Provider-specific prompt artifacts (prompt-only).
// Producer = image-prompt-adapter; consumed by critic-verifier + CODE (validate-candidate, finalize).
// $defs inlined (validation-identical). Lean = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const adapterOutput = Type.Object(
  {
    provider: U(["chatgpt", "gemini"]),
    candidate_id: Type.String({ pattern: "^candidate_[0-9]{3}$" }),
    prompt: Type.String({ minLength: 1 }),
    negative_prompt: Type.String(),
    provider_notes: Type.String(),
    input_assets: Type.Array(Type.Object({ asset_id: Type.String(), role: Type.String(), path: Type.Optional(Type.String()) }, opts)),
    expected_output: Type.Object({ format: Type.String(), ratio: Type.String(), width: Type.Optional(Type.Integer()), height: Type.Optional(Type.Integer()) }, opts),
    verification_checklist: Type.Array(Type.Object({ check: Type.String(), expected: Type.String({ description: "the literal copy string to verify — never a hollow 'headline correct'" }) }, opts), { minItems: 1 }),
    retry_instruction_template: Type.String({ minLength: 1, description: "with a placeholder for the specific failed check" }),
  },
  { ...opts, description: "the 9-field per-candidate provider output" },
);

export const name = "image-adapter-output";
export const schema = Type.Object(
  {
    adapter_id: U(["chatgpt_image", "gemini_image"]),
    provider: U(["chatgpt", "gemini"]),
    run_id: Type.String({ minLength: 1 }),
    outputs: Type.Array(adapterOutput, { minItems: 1, description: "one per candidate" }),
  },
  { ...opts, $id: "https://marketing-img/schemas/image-adapter-output.schema.json", title: "Image adapter output file", description: "provider-specific prompt artifacts (prompt-only; no real provider call)" },
);
