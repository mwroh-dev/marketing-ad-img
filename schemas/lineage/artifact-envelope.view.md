<!-- GENERATED from artifact-envelope.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// lineage envelope: chain + pattern_tag + logic_version stamping ONE stored artifact
artifact-envelope = {
  kind: "perception"|"copy"|"layout"|"visual"|"intent"|"strategy"|"ad-type"|"ad-type-gate"|"bindings"|"opportunity"|"brief"|"candidate"
  key: {
    persona_id: string  // non-empty
    image_ref?: string  // analysis — the ad's stable image join key
    candidate_id?: string  // generation — the candidate id
    run_id?: string  // provenance, NOT the directory key
  }  // identity (persona + image/candidate) + provenance (run)
  pattern_tag: string  // non-empty; shared pattern → peers. analysis: {ad_type}:{benefit}×{funnel}; generation: the opportunity position
  derived_from: {
    kind: string
    ref: string  // non-empty; store-relative path of the parent envelope
  }[]  // the chain — parent envelopes this was built from (machine-resolvable)
  logic_version: {
    version: string  // non-empty
    method: "git"|"content"
    dirty?: boolean  // git only — uncommitted logic changes at stamp time
  }  // which version of the shared logic produced this (a change marks prior artifacts stale)
  produced_by: string  // non-empty; the agent or script that emitted the payload
  stamped_at: string  // non-empty; ISO timestamp when persisted
  payload: object  // the artifact itself — conforms to its own schema
}
```
