<!-- GENERATED from interview-state.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// criteria-driven interview loop state — tracks slot resolution until hard blockers clear
interview-state = {
  run_id: string  // non-empty
  mode: string
  status: "in_progress"|"ready"|"cancelled"|"stopped"
  slots: {
    name: string
    state: "missing"|"insufficient"|"filled"|"confirmed"
    value?: any
    evidence_refs?: string[]
    answer_refs?: string[]
  }[]
  active_blocker?: null|{
    slot: string
    type: "hard_block"|"soft_block"
    question?: string
  }
  history?: {
    answer_ref: string
    slots_updated: string[]
  }[]
}
```
