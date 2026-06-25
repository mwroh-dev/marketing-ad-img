# validate-recipe — runbook

An **on-demand, read-only QA viewer**: turn the analysis artifacts we already extracted into a browser view so
the human can confirm the analyses are *nutritious* (correctly recognized, high-confidence) **before they feed
generation**. Per ad — grouped by collection date — it shows the ad image + ad info + the analysis "recipe"
(type / copy / register / benefit×funnel / first_cognition) shown **faithfully** next to the ad. The orchestrator
reads this runbook when request-evaluation reports `ready` with `detected_mode = validate-recipe`, then runs the
single step below.

> **No system quality verdict.** The viewer does NOT badge/flag/grade analyses. A quality badge would be derived
> from the agent's OWN confidence — and the whole reason a human does this check is that the agent's grounds can be
> wrong, INCLUDING when it was confident (a confidently-wrong analysis carries high confidence → no badge → false
> reassurance → the human skips exactly the card they should scrutinise). So the recipe is shown faithfully and the
> human judges by comparing it to the ad. The agent's confidence is shown only as transparent, labelled self-report
> data — never as a verdict.

> **Read-only. Judgment stays with the human; correction is a terminal conversation.** The viewer never captures a
> selection, writes a flag file, or edits an analysis. To fix a bad analysis the user clicks the ad's **copyable id
> button** and pastes it back here ("이 광고 재분석해줘") — the agent re-runs analysis. We never let a human inline-edit
> a schema (that would overwrite the `grounds_in`/`confidence` discipline with an untraceable hand edit).

## Required state (gate)
- ≥1 collection run for the target persona: `.generate-ads-img/runs/*/ad-creatives/{persona_id}/ad-creative.json`.
  - **0 runs → not runnable.** Nothing to view; route to **data-collection** first.
- Analysis artifacts are read from `runs/{run_id}/analysis/{persona_id}/{ad}/<artifact>.json` (per-ad subdir:
  `perception.json`, `ad-type.json`, `copy.json`, `layout.json`, `visual.json`, `intent.json`, `strategy.json`,
  `ad-type-gate.json`). Ads with **no** analysis still render — flagged `분석 없음` (honest, not hidden). So the
  viewer is useful even mid-analysis, and especially to spot the un-analyzed/low-quality tail.

## What the orchestrator does
1. **Serve (deterministic, no agent, read-only).** Run
   `node ${CLAUDE_PLUGIN_ROOT}/shared/collect/validate-recipe.mjs <persona_id>` **with `run_in_background: true`**.
   It scans every run for that persona, groups by collection date, renders the authored-once template
   (`validate-recipe.template.html`) and prints `SELECT_URL http://127.0.0.1:<port>/`. No LLM regenerates the HTML.
2. **Relay the URL to the user** and explain plainly: a local read-only convenience screen (localhost-only,
   self-closes on idle timeout). Tell them to **compare each ad to its recipe and judge it themselves** (the system
   does not pre-grade — don't rely on it to flag the bad ones), and to **click an ad's 📋 id button to copy it, then
   say which to re-analyze here** (e.g. "이 광고 재분석해줘 / 이거 왜 이렇게 분석됐어").
3. **On a re-analysis request**, locate the ad by the pasted id (`runs/{run_id}/…/images/ad-N.jpg`) and re-run the
   analysis steps for that one image (per `modes/analysis.md`), then the user can re-open the viewer to confirm.

## Gates the orchestrator enforces
- Do not run with 0 runs for the persona — route to data-collection.
- **No writes.** This mode produces no artifact and never moves/deletes a file; if a step would write, it is a defect.

## Failure handling
| Failure | Orchestrator response |
|---|---|
| 0 runs for the persona | not runnable; route to data-collection |
| runs exist but no analysis yet | still serve — every ad shows, un-analyzed ones flagged `분석 없음` (the view IS the to-analyze list) |
| legacy run without a dated id / run.json | grouped by directory mtime (approximate); new dated runs group exactly |
| port/serve fails | report the error; nothing was written (read-only), safe to re-run |

## Outputs
- **None** (read-only). The artifact is the live view; the actionable output is the user copying an id to drive a
  terminal re-analysis conversation.
