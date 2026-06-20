# Don't put doc/comment keys in data validated by `additionalProperties:false`

**Symptom**: A `_note` (or similar comment) key added to a fixture for human readability fails validation with `must NOT have additional properties`.

**Root cause**: Under a strict schema (`additionalProperties:false`), any key not declared in the schema is a violation — including keys whose only purpose is documentation.

**Rule**: Never add doc/comment keys (`_note`, etc.) to data that a strict schema validates. Put explanatory text in the schema's `description`, or scope a comment into an explicitly-allowed container field (e.g. a `resolved_hints` object that permits free-form keys). Keep the validated payload to declared fields only.
