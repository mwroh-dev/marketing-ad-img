# creative-change-analysis - runbook

This mode compares already collected and already persisted ad-analysis snapshots for one persona scope. It answers:
what was created, deleted, persisted, and changed in the static creative recipe; which classified-axis distributions
shifted; which parts are observed/classified/computed/interpreted/inferred; and what the current data cannot support.

V1 uses public ad data only. It is not performance-learning, does not estimate CTR/ROAS/spend, and does not claim
causality.

## Required state

- `brand_id`, `product_id`, `persona_id`.
- `snapshot_selection`: `latest-pair`, `date-range`, or explicit run ids.
- At least one collection snapshot for the persona:
  `.generate-ads-img/runs/{run_id}/ad-creatives/{persona_id}/ad-creative.json`.
- Durable analysis store for the persona: `mcp__plugin_marketing-img_m__analysis_validate_store`
  must PASS before any edge analysis. Collection-only `ad-creative.json` is insufficient.

Execution blockers:

```txt
- persona_id missing
- 0 collection snapshots
- analysis_validate_store FAIL
- edge analysis requested but fewer than 2 dated snapshots
```

Honest degrade:

```txt
- only 1 snapshot: build creative_snapshot only; no diff/candidate/event/report edge claims
- no library_id: include in snapshot, exclude from cross-snapshot create/delete/persisted claims
- low-confidence classified axis: may not become a strong candidate
- no audience_read: no audience/persona shift candidate
```

`persona_id` is the corpus scope, not a true ad-target persona claim. V1 may discuss only
`audience_read.primary` distribution shifts after `strategy-projector` has produced that field.

## Claim boundary

Every report claim must be labeled with one of:

```txt
observed      source artifact directly contained the value
classified    an analysis agent classified the value
computed      deterministic A/B comparison produced the value
interpreted   temporal-change-analyst explains computed candidates in marketing language
inferred      external context overlaps a change and is framed only as a hypothesis
```

Forbidden:

```txt
- inferred as cause
- public ad data as performance proof
- agent recomputation of numbers
- image reopening or fresh OCR
- persona shift without audience_read
```

## Output root

```txt
.generate-ads-img/runs/{run_id}/creative-change/
```

Artifacts:

```txt
creative-snapshot.{from_run_id}.json
creative-snapshot.{to_run_id}.json
creative-diff.json
change-candidates.json
context-calendar.json                  # optional
interpreted-change-events.json
creative-change-report.json
creative-change-report.html
```

## What the orchestrator does

1. **Gate.** Call `mcp__plugin_marketing-img_m__analysis_validate_store` for the `persona_id`; find the selected collection snapshots; stop if the
   requested edge analysis has fewer than 2 dated snapshots.
2. **Load frozen snapshots (deterministic, no agent).** `mcp__plugin_marketing-img_m__analysis_close_run` freezes
   `.generate-ads-img/runs/{run_id}/creative-change/creative-snapshot.{run_id}.json` while that run is the
   store-latest. For a selected FROM/older run, READ this artifact; do not rebuild it from the current per-persona
   store. If the frozen FROM snapshot is missing, stop and re-close/rebuild that run in order before comparing.
   For the current/latest run only, the orchestrator may run
   `mcp__plugin_marketing-img_m__creative_change_build_snapshot`;
   that CLI fails closed when too many ads have no matching store envelopes.
3. **Diff (deterministic, no agent).** If two snapshots are available:
   `mcp__plugin_marketing-img_m__creative_change_compare_snapshots`.
   This writes `creative-diff.json` with inventory, update, distribution, and coverage flags.
4. **Candidates (deterministic, no agent).**
   `mcp__plugin_marketing-img_m__creative_change_detect_candidates`.
   This writes `change-candidates.json`. Low confidence cannot become `strong`; missing `audience_read` suppresses
   audience shift candidates.
5. **Context (optional agent, parallel lane).** Dispatch `market-context-researcher` only with brand/category/target
   market/date range. It writes `context-calendar.json`. It must not receive `creative-diff` or `change-candidates`.
   Because it depends only on the selected date/category, it may run after Gate in parallel with Snapshot/Diff/Candidates
   and only needs to join before Interpret. If the handoff is materialized as JSON, validate it with
   `mcp__plugin_marketing-img_m__handoff_validate` before dispatch.
6. **Interpret (agent).** Dispatch `temporal-change-analyst` with `creative-diff.json`, `change-candidates.json`,
   optional `context-calendar.json`, and optional `competitive-trend.json`. It writes
   `interpreted-change-events.json` and `creative-change-report.json`. If the handoff is materialized as JSON,
   validate it with `mcp__plugin_marketing-img_m__handoff_validate` before dispatch.
7. **Render (deterministic, no agent).**
   `mcp__plugin_marketing-img_m__creative_change_render_report`.
   The renderer validates the payload, escapes dynamic text, and writes `creative-change-report.html`.

## Flow table

| Step | Owner | Input | Output | Validation | Failure |
|---|---|---|---|---|---|
| 1 Gate | orchestrator/tool | persona, snapshots, store | readiness | `analysis_validate_store` | stop |
| 2 Snapshot | tool | frozen run snapshot; latest run + store only when needed | `creative_snapshot` | schema + join coverage | stop on missing frozen FROM / low join coverage |
| 3 Diff | tool | two snapshots | `creative_diff` | schema | stop if <2 for edge |
| 4 Candidate | tool | diff | `change_candidates` | schema | omit unsupported |
| 5 Context | agent optional, parallel after Gate | date/category | `context_calendar` | schema + sources | omit context |
| 6 Interpret | agent | diff/candidates/context | events/report payload | schema + eval sheet | repair agent output |
| 7 Render | tool | report payload | HTML | renderer test | stop |

## Failure handling

| Failure | Orchestrator response |
|---|---|
| 0 snapshots | not runnable; route to data-collection |
| store missing or `analysis_validate_store` FAIL | stop; run/finish analysis close before this mode |
| one snapshot only | write/read the one `creative-snapshot`; do not write diff/candidate/event edge claims |
| selected FROM snapshot missing | stop; do not rebuild an older run from the current per-persona store |
| snapshot join coverage below threshold | stop; do not emit a schema-valid empty-recipe snapshot |
| all ads untrackable | diff carries coverage flag; inventory create/delete/persisted claims are unavailable |
| context unavailable | continue without context; no inferred hypotheses |
| analyst causality/performance/persona overclaim | reject and repair the agent output |

## Verification

- All JSON artifacts validate against their schemas.
- Agent-authored events/report pass `shared/collect/creative-change-agent-eval.mjs`: candidate ids are real, positive
  performance/causal/persona overclaims are rejected, disclaimer wording is allowed, and output numbers must appear in
  the deterministic inputs.
- Materialized agent handoffs pass `shared/harness/validate-subagent-projection.mjs` before dispatch.
- `change-candidates.json` is produced without an agent.
- `interpreted-change-events.json` is independent from HTML rendering.
- Report separates observed/computed/classified/interpreted/inferred.
- No persona/audience shift appears without `audience_read`.
- No context event is presented as causal.
- Vision remains spent only once in `perception`; this mode never opens images.
