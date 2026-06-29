# context-overlap-not-cause

## Input Artifacts
- `change-candidates.json` with one material shift.
- `context-calendar.json` has an overlapping event.

## Must Say
- Context may be mentioned only as an overlapping external condition or hypothesis.

## Must Not Say
- Do not say the event caused the shift.
- Do not use "because", "due to", or equivalent causal wording.

## Required Claim Kinds
- `interpreted` for the candidate explanation.
- `inferred` for context overlap.

## Number Fidelity Checks
- Candidate numbers unchanged.
- Context dates match `context-calendar.json`.

## Pass Criteria
- `inferred_hypotheses[]` exists only when context is supplied.
- Causal wording is absent.

