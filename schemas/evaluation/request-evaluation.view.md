<!-- GENERATED from request-evaluation.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// classifies mode, required slots, blockers, ready, and the next interview target
request-evaluation = {
  run_id: string  // non-empty
  raw_request?: string
  detected_mode: "initial-setup"|"data-collection"|"competitive-report"|"validate-recipe"|"image-generation"|"performance-learning"|"unknown"
  mode_confidence?: number /*0..1*/  // <0.6 (with a risk_flag) when the call is uncertain
  required_slots: string[]
  slot_states: {
    name: string
    state: "missing"|"insufficient"|"filled"|"confirmed"
  }[]
  blockers: {
    slot: string
    type: "hard_block"|"soft_block"
    priority: int /*1..*/
    reason?: string
  }[]
  ready: boolean  // true ⇔ zero hard_block remains (count, never assert)
  next_interview_target: null|{
    slot: string
    rationale?: string
  }  // null IFF ready; else the highest-priority HARD blocker
  risk_flags?: string[]
}
```
