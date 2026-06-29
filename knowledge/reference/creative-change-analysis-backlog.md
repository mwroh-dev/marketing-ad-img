# creative-change-analysis backlog

Status: follow-up backlog after the 2026-06-29 final quality pass.

These items are not ship blockers for the current `creative-change-analysis` implementation. They are the remaining
quality and operations checks that could not be fully closed without more real data or a broader reliability pass.

## 1. Real dated temporal pair validation

Priority: high

Problem:
The mode has been validated with real code paths, real `close-analysis`, real Claude `temporal-change-analyst`
dispatch, and real report rendering. However, the actual temporal edge still used fixture analysis payloads because
there were not two genuinely dated real collection snapshots for the same persona.

Required follow-up:
- Collect or identify two real dated collection snapshots for the same `persona_id`.
- Run analysis to durable store for each snapshot.
- Confirm each run has its own frozen `creative-snapshot.{run_id}.json`.
- Run the full edge path: snapshot read -> diff -> candidates -> optional context -> temporal agent -> report -> HTML.

Acceptance:
- FROM snapshot is read from the frozen run-local artifact, not rebuilt from current store.
- `validate-store`, `creative-diff`, `change-candidates`, projection guard, agent eval, and renderer all pass.
- Report distinguishes observed/classified/computed/interpreted/inferred claims.
- Any remaining synthetic fixture input is explicitly reported as synthetic.

## 2. Make `close-analysis` more atomic

Priority: medium

Problem:
`close-analysis` persists store envelopes and freezes creative snapshots before advancing the run ledger. If
`advanceStage` fails because `run.json` is missing or invalid, the store/snapshot may already be written while the
ledger remains unadvanced.

Current impact:
Low in the normal consumer flow because collection creates `run.json` before analysis close. It is still a robustness
gap for partial/manual/sandbox runs.

Required follow-up:
- Decide whether `close-analysis` should fail before writes when `run.json` is absent, or write a recoverable
  partial-close marker.
- Add a regression test for `run.json` missing/invalid.
- Ensure rerunning `close-analysis` after fixing the manifest is deterministic and does not corrupt store state.

Acceptance:
- No silent state where persisted analysis looks complete but the run ledger is misleading.
- Failure message tells the operator whether to repair `run.json`, rerun collection, or rerun close-analysis.

## 3. Refine positive-claim eval boundaries

Priority: medium

Problem:
`creative-change-agent-eval.mjs` now rejects positive performance/causal/persona overclaims and allows normal
disclaimer wording. The remaining risk is edge wording: terms such as `효과` can be non-performance context
(`시각 효과`), and Korean uncertainty phrasing such as `모릅니다` / `모름` should be recognized as negation.

Required follow-up:
- Add eval fixtures for Korean uncertainty phrases: `모름`, `모릅니다`, `알 수 없음`.
- Add English uncertainty phrases: `unknown`, `unclear`, `not known`.
- Narrow `효과` matching so visual/design effect wording is not treated as a performance claim.

Acceptance:
- Positive claims like `CTR improved`, `이 이벤트 때문에 바뀌었다`, and `페르소나가 바뀌었다` still fail.
- Disclaimers and uncertainty statements pass.
- No new false negatives for actual performance/causal/persona overclaims.
