<!-- GENERATED from logic-change.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// audit record of a shared-logic change — human provenance + staleness impact
logic-change = {
  change_id: string  // non-empty
  at: string  // non-empty; ISO timestamp
  trigger: {
    persona_id: string  // non-empty
    slot?: string
    image_ref?: string
    pattern_tag?: string
  }  // the ad that EXPOSED the flaw (the symptom)
  finding: string  // non-empty; what the human judged wrong
  qa_log?: {
    role: "user"|"agent"
    text: string
  }[]  // STRUCTURED record the agent authored (not a raw transcript dump)
  commit_sha: string  // non-empty; the git commit that IS the logic fix
  scope: "pattern"|"slot"|"persona"|"global"
  impact: {
    stale_count: int /*0..*/
    stale_refs?: string[]
    pattern_tags?: string[]
  }  // what the change makes stale (flag only — re-run is the human's choice)
}
```
