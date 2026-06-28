<!-- GENERATED from image-adapter-output.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// provider-specific prompt artifacts (prompt-only; no real provider call)
image-adapter-output = {
  adapter_id: "chatgpt_image"|"gemini_image"
  provider: "chatgpt"|"gemini"
  run_id: string  // non-empty
  outputs: {
    provider: "chatgpt"|"gemini"
    candidate_id: string  // matches /^candidate_[0-9]{3}$/
    prompt: string  // non-empty
    negative_prompt: string
    provider_notes: string
    input_assets: {
      asset_id: string
      role: string
      path?: string
    }[]
    expected_output: {
      format: string
      ratio: string
      width?: int
      height?: int
    }
    verification_checklist: {
      check: string
      expected: string  // the literal copy string to verify — never a hollow 'headline correct'
    }[]  // 1.. items
    retry_instruction_template: string  // non-empty; with a placeholder for the specific failed check
  }[]  // 1.. items; one per candidate
}
```
