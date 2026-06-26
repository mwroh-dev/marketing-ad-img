<!-- GENERATED from copy-analysis.ts by schemas/build.ts — do not edit by hand -->
```ts
// text-role + hook + keywords, from L1 text content only
copy-analysis = {
  image_ref: string
  persona_id: string
  copy_elements: {
    content: string  // verbatim from the perception text element it came from
    source_id?: string  // the perception text element id (t#) this came from — makes the role traceable without the image; omit only if no single element maps
    text_role: "headline"|"subcopy"|"CTA"|"badge"|"price"|"review_quote"|"spec_label"|"other"  // what the line DOES (function), not a keyword match
    hook_type?: "question"|"contrast"|"result"|"empathy"|"number"|"other"  // rhetorical function of a hook-bearing line; off/other on badge/price/spec/cta
    confidence?: "high"|"medium"|"low"
  }[]
  sentence_patterns?: string  // recurring sentence STRUCTURE (imperative/declarative mix, question framing, number+unit cadence…), NOT a paraphrase of content
  keywords?: string[]  // meaning-bearing surface forms verbatim (no score/rank — the deterministic script ranks)
}
```
