<!-- GENERATED from critic-verdict.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-candidate PASS/FAIL + overall verdict
critic-verdict = {
  verdicts: {
    candidate_id: string
    pass: boolean  // true only when EVERY check cleared with nameable evidence (adversarial default false)
    issues?: string[]  // one concrete sentence per real defect — never fabricated
    risk_flags?: string[]  // categorical tags: forbidden_claim/overclaim/near_duplicate/brand_mismatch/altered_korean/empty_verification/boundary_violation
  }[]  // 1.. items
  overall_pass: boolean  // AND of every candidate's pass
}
```
