<!-- GENERATED from market-position-matrix.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-persona benefit×funnel positioning matrix (observed prevalence, not performance); whitespace = low frequency
market-position-matrix = {
  persona_id: string  // non-empty
  total_ads: int /*0..*/
  by_benefit_and_funnel: {
    function: {
      discovery: int /*0..*/
      comparison: int /*0..*/
      action: int /*0..*/
      retention: int /*0..*/
      unclear: int /*0..*/
    }
    cost: {
      discovery: int /*0..*/
      comparison: int /*0..*/
      action: int /*0..*/
      retention: int /*0..*/
      unclear: int /*0..*/
    }
    trust: {
      discovery: int /*0..*/
      comparison: int /*0..*/
      action: int /*0..*/
      retention: int /*0..*/
      unclear: int /*0..*/
    }
    symbol: {
      discovery: int /*0..*/
      comparison: int /*0..*/
      action: int /*0..*/
      retention: int /*0..*/
      unclear: int /*0..*/
    }
    unclear: {
      discovery: int /*0..*/
      comparison: int /*0..*/
      action: int /*0..*/
      retention: int /*0..*/
      unclear: int /*0..*/
    }
  }  // FULL benefit×funnel grid — 0 cells ARE the whitespace signal (counts = observed prevalence, NOT performance)
  dominant_positions?: {
    position: string
    count: int /*0..*/
    share: number
    common_ad_types?: string[]
    common_execution_styles?: string[]
    common_devices?: string[]
  }[]
  crowded_positions?: {
    position: string
    reason: string
  }[]  // high observed frequency
  whitespace_positions?: {
    position: string
    reason: string
  }[]  // low observed frequency — a GAP, not a guaranteed opportunity
  high_reusability_patterns?: {
    position: string
    devices?: string[]
    why_reusable?: string
  }[]
  risks?: {
    risk: string
    reason: string
  }[]
  coverage_flags?: string[]
  generated_at?: string
}
```
