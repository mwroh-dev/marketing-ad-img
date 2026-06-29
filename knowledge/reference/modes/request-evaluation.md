# request-evaluation — runbook

The entry mode: when a request arrives, the orchestrator routes it here first to classify the mode, find slot gaps/blockers, and pick the next interview target before any mode runs.

## What the orchestrator does

This mode is largely the **`request-evaluator` agent's** job, wrapped by the **interview loop**. The orchestrator does not analyze the request itself — it dispatches the agent, then drives the loop. Full mechanics: `${CLAUDE_PLUGIN_ROOT}/knowledge/reference/request-evaluation-and-interview-loop.md` (cross-ref; keep this runbook short).

1. **Dispatch `request-evaluator`** against the current request. It reads `raw_request` (current user message), `registry/mode-contracts.yaml`, the `registry/` summaries (products, personas, brands, source-targets), and the run's `interview-state.json` + `user-answers/` refs. It does NOT execute a mode and does NOT ask the user anything.
2. The agent writes a single artifact `→ .generate-ads-img/runs/{run_id}/request-evaluation.json` (schema `${CLAUDE_PLUGIN_ROOT}/schemas/evaluation/request-evaluation.schema.json`) carrying: `detected_mode` (`initial-setup | data-collection | competitive-report | creative-change-analysis | validate-recipe | image-generation | performance-learning | unknown`), `mode_confidence`, `required_slots[]`, `slot_states[]`, `blockers[]` (each `slot` + `type` `hard_block|soft_block` + `priority` + `reason`), `ready`, `next_interview_target` (null or `{slot, rationale}`), `risk_flags[]`.
3. **Read `ready` to gate:** if `ready=false`, the orchestrator hands `next_interview_target` to the **interview loop** (the `interview-controller` agent), which asks the user; every answer is structured back into interview-state via `user-answer-tooling`, then the orchestrator re-dispatches `request-evaluator`. This is a criteria-driven state loop, not a fixed question count.
4. **Only when `ready=true`** does the orchestrator dispatch `detected_mode`. No mode runs before this reports ready.

## Gates the orchestrator enforces

- `ready = true` only when zero hard blockers remain; the next interview target is always the highest-priority unfilled hard blocker (hard before soft, `priority` 1 = highest).
- The evaluator only evaluates — it never executes a mode, never asks the user a question, and never updates interview-state directly (that is `user-answer-tooling`'s job).
- `slot_states` are derived strictly from current interview-state values + evidence_refs; the artifact is validated against the schema before it is acted on.

## Failure handling

| Failure | Orchestrator response |
|---|---|
| interview-state / `run_id` not found | evaluator reports the blocker, `ready=false`, `detected_mode=unknown`; orchestrator stays in setup/interview |
| Output fails schema validation | reject the artifact; do not route on an invalid evaluation |
| Mode cannot be determined | `detected_mode=unknown`, `mode_confidence=0`, surfaced as `risk_flag`; resolve via interview before dispatching |
| Slot evidence contradicts raw answer refs | surfaced as `risk_flag`, not silently resolved; orchestrator routes back through the interview |
