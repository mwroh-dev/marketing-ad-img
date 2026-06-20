# JSON Schema draft 2020-12 needs `Ajv2020`, and compile must be memoized

**Symptom**: Validating a draft-2020-12 schema with Ajv fails with `no schema with key ... 2020-12`. Separately, compiling the same `$id` twice throws `schema already exists`.

**Root cause**: The default `import Ajv from "ajv"` only knows the draft-07 meta-schema, so it can't resolve the 2020-12 meta-schema. And Ajv registers schemas by `$id`, so compiling the same schema object twice in one Ajv instance is a duplicate registration.

**Rule**: For draft 2020-12, import the 2020 build — `import Ajv2020 from "ajv/dist/2020.js"`. Memoize compiled validators keyed by schema file/`$id` and reuse them, so a schema is compiled once per process. Centralize this in a shared validation lib.
