<!-- GENERATED from user-answer.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// an interview answer — raw text verbatim + derived normalized slot updates
user-answer = {
  answer_id: string  // non-empty
  run_id: string  // non-empty
  raw_answer: string  // preserved VERBATIM — never paraphrased
  for_blocker: {
    slot: string
    question?: string
  }
  normalized_slot_updates: {
    slot: string
    value: any  // the structured value (any shape)
    resulting_state: "missing"|"insufficient"|"filled"|"confirmed"
    evidence_refs?: string[]
  }[]  // 1.. items; one answer may update multiple slots
  notes?: string
}
```
