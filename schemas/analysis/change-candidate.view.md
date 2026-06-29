<!-- GENERATED from change-candidate.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// deterministic creative-change candidates, before agent interpretation
change-candidate = {
  from_snapshot_id: string  // non-empty
  to_snapshot_id: string  // non-empty
  candidates: {
    candidate_id: string  // non-empty
    candidate_type: "inventory_change"|"appeal_shift"|"funnel_shift"|"benefit_shift"|"visual_register_shift"|"layout_shift"|"copy_role_shift"|"audience_read_shift"
    claim_kind: "computed"
    input_claim_kinds: ("observed"|"classified")[]
    axis: string  // non-empty
    from?: any
    to?: any
    support_count: int /*0..*/
    share_delta: number
    strength: "weak"|"medium"|"strong"
    evidence_refs: string[]
    coverage_flags: string[]
  }[]
  coverage_flags: string[]
  generated_at?: string
}
```
