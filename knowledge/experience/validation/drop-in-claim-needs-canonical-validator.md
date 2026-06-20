# "Drop-in for the next stage" requires passing that stage's canonical validator

**Symptom**: An artifact is reported as a verified, ready "drop-in" for the next stage based on file-copy + JSON-write + eyeballing — but running the consuming stage's canonical validator fails it (enum mismatches, `additionalProperties:false` violations). The same violation often hides in sibling outputs too.

**Root cause**: "Live proof" stopped at producing a file that looks right; it never ran the schema/validator the *consumer* actually enforces. File-creation success is not contract satisfaction.

**Rule**: Before claiming any artifact is a drop-in for a downstream stage, run that stage's canonical schema/validator against it and make it pass — and pin it with an Ajv regression test where a schema exists. When you add a new source or field, extend the corresponding strict schema (`additionalProperties:false`) at the same time, and re-validate sibling outputs that share the schema.
