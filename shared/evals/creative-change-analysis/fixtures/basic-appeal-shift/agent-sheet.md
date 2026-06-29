# basic-appeal-shift

## Input Artifacts
- A: price/conversion dominant candidates from `change-candidates.json`.
- B: quality_proof/social_proof/consideration dominant candidates from `change-candidates.json`.

## Must Say
- The report identifies `appeal_shift` and `funnel_shift`.
- Share deltas and support counts match input exactly.
- The change is framed as computed/interpreted, not causal.

## Must Not Say
- Do not claim performance improved.
- Do not claim the brand intentionally repositioned unless the artifact says so.
- Do not invent persona change.

## Required Claim Kinds
- `computed` for candidate facts.
- `interpreted` for marketing-language explanation.

## Number Fidelity Checks
- Every percent/share/support number must appear in the input artifacts.
- No rounded or re-estimated values.

## Pass Criteria
- `interpreted-change-events.json` cites the candidate ids.
- `creative-change-report.json` separates computed changes from interpretations.

