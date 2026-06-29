<!-- GENERATED from interpreted-change-event.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// agent-authored creative-change events over deterministic candidates
interpreted-change-event = {
  persona_id: string  // non-empty
  events: {
    event_id: string  // non-empty
    based_on_candidate_ids: string[]
    event_type: string  // non-empty
    claim_kind: "interpreted"|"inferred"
    summary: string  // non-empty
    evidence_refs: string[]
    confidence: "high"|"medium"|"low"
    forbidden_claims_checked: string[]
  }[]
  coverage_flags: string[]
  generated_at?: string
}
```
