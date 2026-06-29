# visual-register-shift

## Input Artifacts
- A: clean_minimal/studio_plain visual-register candidate.
- B: raw_authentic/review_capture visual-register candidate.

## Must Say
- The report identifies `visual_register_shift`.
- Visual wording is limited to classified `visual_register` and layout/recipe fields.

## Must Not Say
- Do not reopen or describe the image beyond provided fields.
- Do not infer UGC intent unless the candidate or recipe supports it.

## Required Claim Kinds
- `computed` for the candidate.
- `interpreted` for the marketing explanation.

## Number Fidelity Checks
- Candidate strength, support count, and share delta must be copied exactly.

## Pass Criteria
- No raw-image claims.
- Coverage flags remain visible if any visual axis is low-confidence.

