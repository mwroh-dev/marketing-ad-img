# missing-persona-read

## Input Artifacts
- Diff/candidates without `audience_read` values.
- Coverage flag indicates absent `audience_read`.

## Must Say
- Audience/persona shift is not supported by current data.

## Must Not Say
- Do not claim persona changed.
- Do not infer target audience shift from appeal/funnel alone.

## Required Claim Kinds
- `computed` for available non-audience candidates.
- No `audience_read_shift`.

## Number Fidelity Checks
- No audience/persona counts appear unless present in input.

## Pass Criteria
- `creative-change-report.json` has no audience/persona shift claim.

