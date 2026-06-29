<!-- GENERATED from creative-diff.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// computed edge between two creative snapshots
creative-diff = {
  from_snapshot_id: string  // non-empty
  to_snapshot_id: string  // non-empty
  persona_id: string  // non-empty
  inventory_delta: {
    created: {
      ad_key: string  // non-empty
      library_id?: string
      image_ref: string  // non-empty
    }[]
    deleted: {
      ad_key: string  // non-empty
      library_id?: string
      image_ref: string  // non-empty
    }[]
    persisted: {
      ad_key: string  // non-empty
      library_id?: string
      image_ref: string  // non-empty
    }[]
    untrackable: {
      ad_key: string  // non-empty
      library_id?: string
      image_ref: string  // non-empty
    }[]
  }
  update_delta: {
    same_library_id_changed_recipe: {
      library_id: string  // non-empty
      changed_axes: string[]
      before: {

      }
      after: {

      }
      evidence_refs: string[]
    }[]
  }
  distribution_delta: {

  }
  coverage_flags: string[]
  generated_at?: string
}
```
