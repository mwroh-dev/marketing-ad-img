<!-- GENERATED from creative-change-report.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// final creative-change report payload before deterministic HTML rendering
creative-change-report = {
  persona_id: string  // non-empty
  snapshot_range: {
    from_snapshot_id: string  // non-empty
    to_snapshot_id: string  // non-empty
  }
  confirmed_changes: {
    claim_kind: "observed"|"computed"
    summary: string  // non-empty
    evidence_refs?: string[]
  }[]
  classified_interpretations: {
    claim_kind: "classified"|"interpreted"
    summary: string  // non-empty
    evidence_refs?: string[]
  }[]
  inferred_hypotheses: {
    claim_kind: "inferred"
    summary: string  // non-empty
    evidence_refs?: string[]
  }[]
  coverage_flags: string[]
  synthesis?: string
  generated_at?: string
}
```
