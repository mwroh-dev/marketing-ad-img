<!-- GENERATED from consumer.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
consumer = {
  image_ref: string  // non-empty
  persona_id: string  // non-empty
  copy_elements: {
    content: string  // verbatim from the perception text element it came from
    text_role: "headline"|"subcopy"|"CTA"|"badge"|"price"|"review_quote"|"spec_label"|"other"  // what the line DOES (function), not a keyword match
    hook_type?: "question"|"contrast"|"result"|"empathy"|"number"|"other"  // rhetorical function of a hook-bearing line; off/other on badge/price/spec/cta
    confidence?: "high"|"medium"|"low"
  }[]
  sentence_patterns?: string  // recurring sentence STRUCTURE (imperative/declarative mix, question framing, number+unit cadence…), NOT a paraphrase of content
  keywords?: string[]  // meaning-bearing surface forms verbatim (no score/rank — the deterministic script ranks)
}
```
