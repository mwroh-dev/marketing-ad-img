# Grep the whole repo before concluding "no real data exists"

**Symptom**: A run concludes there is no real input data because the expected shared-samples directory is empty — then builds everything on synthetic input, missing real artifacts that were sitting elsewhere in the repo.

**Root cause**: Real outputs from earlier demo/e2e runs land under run-output directories (e.g. `.generate-ads-img/runs/*`), not the expected samples folder. Checking only the canonical input path gives a false "no data" verdict.

**Rule**: Before declaring "no real data," grep/find across the whole repo (including run-output dirs like `.generate-ads-img/runs/*`) for the relevant file types. Prior runs frequently left real data behind. Conclude "no data" only after a repo-wide search genuinely comes up empty — and then report that gap honestly (a coverage flag), never substitute fabricated/constructed data and pass it off as real.
