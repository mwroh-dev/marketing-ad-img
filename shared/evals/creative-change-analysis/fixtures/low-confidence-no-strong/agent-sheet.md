# low-confidence-no-strong

## Input Artifacts
- A material classified-axis shift with `confidence_floor: low`.

## Must Say
- The shift can be discussed only with confidence caveat.

## Must Not Say
- Do not call the candidate `strong`.
- Do not remove the low-confidence coverage flag.

## Required Claim Kinds
- `computed` for the capped candidate.
- `interpreted` only with caveat.

## Number Fidelity Checks
- Strength equals the deterministic candidate strength.

## Pass Criteria
- No low-confidence candidate is promoted to a strong final statement.

