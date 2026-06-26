<!-- GENERATED from brand-research.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// one brand-researcher angle — public-source evidence + data-derived candidates
brand-research = {
  brand_id: string  // non-empty
  angle: "page"|"reviews"|"positioning"  // which research lens this artifact covers
  sources_consulted: {
    ref: string  // non-empty; URL or search query actually used
    method: "curl"|"webfetch"|"websearch"|"cdp"
    reached?: boolean  // false if blocked/unreachable
  }[]  // every public source actually fetched/searched (honest)
  evidence: {
    observation: string  // non-empty
    source_ref: string  // non-empty; which sources_consulted[].ref this came from
  }[]  // concrete observations — facts, not interpretation; each candidate traces here
  category_candidates?: {
    category: string  // non-empty
    evidence_refs: string[]  // 1.. items
  }[]
  persona_candidates?: {
    label: string  // non-empty
    who: string  // non-empty; who this buyer is, in plain terms
    pains?: string[]
    desires?: string[]
    evidence_refs: string[]  // 1.. items; review/page observations grounding this persona — no fabrication
  }[]  // data-derived persona options for the interview to present as CHOICES
  positioning_signals?: string[]
  forbidden_claim_risks?: string[]  // claims observed that may be over-claims to guard downstream
  coverage_flags?: string[]  // what could NOT be reached/found — honest gaps
}
```
