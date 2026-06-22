# competitive-report — runbook

A reporting mode: turn the ad creatives already collected (across one or more dated collection runs) into a
**per-persona competitive intelligence report** for the human consumer (seller/advertiser) — longevity (run-duration = longevity proxy), per-advertiser creative variation/cadence (how much variation they produce), what is being tested vs
dropped, and the prevailing copy appeals. The orchestrator reads this runbook when
request-evaluation reports `ready` with `detected_mode = competitive-report`, then dispatches the steps below.

> **Not performance-learning.** This mode does NOT feed measured ad-performance metrics into candidate
> generation (that loop is a non-negotiable BACKLOG rule, `knowledge/reference/non-negotiable-rules.md`). It
> reports PUBLIC-DATA PROXIES (longevity, variation) — Meta exposes no spend/CTR/ROAS for commercial ads — and
> never claims otherwise.

## Required state (gate)
- ≥1 collection snapshot for the target persona: `.generate-ads-img/runs/*/ad-creatives/{persona_id}/ad-creative.json`.
  - **0 snapshots → not runnable.** The mode has nothing to aggregate; route back to **data-collection** first
    (request-evaluation should surface this as a hard blocker, not produce an empty report).
- The longevity signal needs `started_at` on the creatives (captured by the Meta detail-modal flow). Cross-time
  signals (new/disappeared/cadence) need **≥2 dated snapshots** collected over time; with one snapshot the
  report degrades honestly to longevity + variation only.

## What the orchestrator does
1. **Aggregate (deterministic, no agent).** Run `${CLAUDE_PLUGIN_ROOT}/shared/harness/run-competitive-trend.ts <persona_id> <run_id> [today_iso]`.
   It globs every dated snapshot of that persona, orders by `captured_at`, and writes
   `.generate-ads-img/runs/{run_id}/competitive-trend.json` (schema `competitive-trend.schema.json`,
   validated in-script). The script OMITS any unsupported field and surfaces every gap as a `coverage_flag`
   (single-snapshot, missing started_at, missing library_id, undated snapshot) — never zero-fills.
2. **Narrate (agent `competitive-analyst`).** Project the freshly written `competitive-trend.json` (+ the
   persona's `ad-pattern.json` if it exists, for appeals) to `competitive-analyst`. It adds ONLY `synthesis`
   (+ optional `confidence_note`) to the trend file, narrating the numbers — it recomputes nothing and invents
   no per-ad link the data lacks.
3. **Render (deterministic, no agent).** Run `${CLAUDE_PLUGIN_ROOT}/shared/harness/render-report.mjs <competitive-trend.json> [out.html]`.
   It fills the authored-once template (`competitive-report.template.html`) → `competitive-report.html`. No LLM
   regenerates HTML per run (token-cheap by design). Absent data renders an explicit "not yet observable / more snapshots needed"
   note; every coverage_flag is shown (provenance/gap trail).
4. **Report to the user** with the provenance trail (per `completion-verification-policy.md`): which snapshots
   (paths + captured_at), how many ads tracked, the longevity top + variation leaders, and — honestly — every
   gap (single snapshot, ads without started_at, etc.). Hand over the `competitive-report.html` path. A thin
   verdict ("N competitors") is not acceptable.

## Gates the orchestrator enforces
- Do not run with 0 snapshots — route to data-collection instead.
- The trend artifact must pass `competitive-trend.schema.json` before the analyst is dispatched (shape gate).
- `competitive-analyst`'s output is completion-judged by independent verification (shape via validator + its
  `## Verification checklist` applied to the actual output) — self-declaration is void. The "must NOT" items
  (no fabricated change-claims on a single snapshot, longevity framed as proxy not measured performance, no
  invented appeals) anchor false-positive = 0.

## Failure handling
| Failure | Orchestrator response |
|---|---|
| 0 snapshots for the persona | not runnable; route to data-collection; do not emit an empty report |
| single snapshot only | proceed, but the report covers longevity + variation only; new/disappeared/cadence are absent + flagged (honest degrade) |
| no `started_at` captured on any ad | longevity ranking empty; report says so via coverage_flag; do not fabricate a "validated ad" claim |
| trend artifact fails schema | reject; fix the aggregator/inputs before dispatching the analyst |
| analyst synthesis contradicts the numbers | fails the checklist (logic gate); send back for repair — the numbers win |

## Outputs
- `.generate-ads-img/runs/{run_id}/competitive-trend.json` — the aggregate + `synthesis`.
- `.generate-ads-img/runs/{run_id}/competitive-report.html` — the consumer-facing report.
