# single-snapshot-no-edge

## Input Artifacts
- One `creative-snapshot` only.
- No `creative-diff.json`.
- No `change-candidates.json`.

## Must Say
- Edge analysis is not available with one snapshot.
- Only static snapshot coverage can be discussed.

## Must Not Say
- Do not say "no changes".
- Do not create interpreted events.
- Do not create context hypotheses.

## Required Claim Kinds
- `observed` or `classified` only, if a static snapshot summary is produced.

## Number Fidelity Checks
- No A/B deltas appear.

## Pass Criteria
- No diff/candidate/event artifact is produced for this case.

