<!-- GENERATED from candidate-selection-log.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// records why each candidate was generated (joinable by candidate_id)
candidate-selection-log = {
  run_id: string  // non-empty
  candidate_count: int /*1..12*/
  selection_strategy: string
  candidates: {
    candidate_id: string  // matches /^candidate_[0-9]{3}$/
    angle: string
    primary_variable: string
    product_id: string
    persona_id: string
    copy_strategy?: string
    layout_strategy?: string
    format: string
    adapter?: string[]
    reason: string  // non-empty
  }[]  // 1.. items
}
```
