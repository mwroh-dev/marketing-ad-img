<!-- GENERATED from context-calendar.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// external context calendar for creative-change analysis; correlation only, no causality
context-calendar = {
  persona_id: string  // non-empty
  date_range: {
    from: string  // non-empty
    to: string  // non-empty
  }
  events: {
    event_type: "season"|"holiday"|"market_issue"|"brand_event"|"competitor_event"|"other"
    date_range: {
      from: string  // non-empty
      to: string  // non-empty
    }
    summary: string  // non-empty
    sources: string[]
    confidence: "high"|"medium"|"low"
  }[]
  coverage_flags: string[]
  generated_at?: string
}
```
