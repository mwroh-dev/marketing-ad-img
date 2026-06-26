<!-- GENERATED from ad-type-gate.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// deterministic per-ad gate: routed adapter requires vs the analyses → gates_raised (no LLM)
ad-type-gate = {
  image_ref: string  // non-empty
  persona_id?: string
  ad_type: string
  requires_checked: string[]
  gates_raised: string[]
}
```
