<!-- GENERATED from keyword-plan.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// pre-collection 3-axis (Needs/Use-case/Adjacency) keyword expansion for coverage
keyword-plan = {
  product_id: string  // non-empty
  persona_id: string  // non-empty
  target_market: string  // non-empty; language/market scope the queries are written for, e.g. KR
  axes: {
    needs: {
      term: string  // non-empty
      rationale?: string  // one line: why this term belongs to this axis
    }[]  // Needs — the underlying job/desire the buyer is solving
    use_case: {
      term: string  // non-empty
      rationale?: string  // one line: why this term belongs to this axis
    }[]  // Use-case — when/where the behavior happens (occasion/scene)
    adjacency: {
      term: string  // non-empty
      rationale?: string  // one line: why this term belongs to this axis
    }[]  // Adjacency — products the same buyer also seeks (concrete co-sought nouns)
  }  // the three expansion axes (goal is COVERAGE, not precision)
  queries: {
    query: string  // non-empty; the actual search string for Meta keyword search
    mode: "keyword"
    axis: "needs"|"use_case"|"adjacency"
  }[]  // 1.. items; flattened search queries — every query traces to an axis
}
```
