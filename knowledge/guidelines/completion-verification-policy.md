# 11 — Completion & Verification Policy (no false completion)

This project's **completion (done) discipline**. The canonical policy for preventing false completion, where autonomous execution declares it "roughly finished." This methodology is a project discipline, canonicalized here.

## Core discipline
**Completion is not a self-declaration by the executor (agent).** It is done only when independent verification yields a pass on **both implementation robustness ∧ test robustness**. (KB: `orchestrator-independent-verification` — self-report ≠ done.)

## Completion = two dimensions (both satisfied)
1. **Implementation robustness** — **run on real data** per the contract, with schema/validator PASS + **evidence of a real run**. (No smoke/mock — `operational-repeatability-vs-demo`: a one-off demo ≠ a system.)
2. **Test robustness** — depends on output type:
   - **Deterministic logic** = `node:test` (edges) — keep covering the boundary cases.
   - **LLM output** = verified on its ACTUAL output over real data along two axes:
     - **Shape** — the output passes its `${CLAUDE_PLUGIN_ROOT}/schemas/<stage>/` contract via `${CLAUDE_PLUGIN_ROOT}/shared/validators/validate-*.ts`.
     - **Logic** — a reviewer **independent of the producing agent** applies that agent's `## Verification checklist` (the logical gate) to the actual output. The checklist's **"must NOT" criteria anchor false-positive = 0** — a single violation fails the output even when it is schema-valid.
   - Both axes must pass, adjudicated by independent verification.

## Four mechanisms that prevent false completion
1. **Persistence** — the self-loop does not stop until it yields a pass. "Roughly finished" is incomplete.
2. **Self-review → independent verification (both)** — the executor first reviews and corrects its own output against the schema and checklist (no "it's done" the moment it's produced), and *then* independent verification adjudicates. Self-review does not replace independent verification.
3. **Real LLM execution test** — verification runs against the agent's real output on real data, not a mock (no smoke).
4. **Independent logical gate (no back-derivation)** — the checklist that adjudicates the output is **authored against the agent's contract, not reverse-engineered from the output it is judging**. Do not judge an output against criteria you derived from that same output (self-fulfilling). The reviewer applying the checklist must be independent of the producing agent.

## Independent-verification record (no hollow)
Putting only summary numbers in the verification result is **invalid (fake)**. The record must cite the **agent's actual output per checklist item** — for each item: the criterion, the relevant slice of the actual output, and pass/fail (for "must NOT" items, whether the violation was present). A bare pass/fail summary with no per-item trace of the real output does not count as verification.

## Embedded process principles (KB candidates)
| Principle | Application |
|---|---|
| orchestrator-independent-verification | Completion is adjudicated by independent verification, not the executor. Self-report ≠ done. |
| stage-local-completion-and-repair | On failure, fix only that stage/dimension, no full re-run. |
| acquisition-must-not-outrun-validation-contract | Collection is deployed only after the validation contract (schema + validator) is locked. |
| pilot-run-before-batch | Collection/batch goes to batch only after verifying one pilot. |
| operational-repeatability-vs-demo | Adjudicate by a real run, not a one-off demo. pass@1 on a demo is insufficient. |
| deterministic-input-structure | On re-run, re-inject state (current status, prior decisions, known errors, constraints). |

## Provenance / search-trail reporting (collection + research)

When a collection or research step reports to the user, a **thin conclusion is not acceptable** (e.g., "There is 1 competitor.").
The user paid LLM tokens to search — show the **trail** so the result is trustworthy and can be built on:
- **WHERE**: each source actually used (Meta Ad Library / Google Ads Transparency / web search / a public review page) + access mode.
- **WHAT QUERY**: the exact keywords/advertiser names searched, per source.
- **WHAT WAS FOUND**: counts (N ads, M reviews), the locations (image file paths / URLs), what kind (ad image / detail page / review).
- **WHAT WAS MISSING**: every gap honestly — "Meta surface not yet implemented", "no_advertiser_match: X", "searched but insufficient" — as coverage flags, never silent.
The artifacts already carry this (source / search / queries / coverage_flags / image_url / sources_consulted); the
report must SURFACE it, not hide it behind a summary. "Searched A and B — found N here, insufficient there" is the shape — a
defensible trail the user can extend, vs an unsourced verdict they cannot trust.

## How to run it again (without lanes)
Apply this policy every time you harden a new stage/feature: **define the expected behavior first → run on real data → self-review against schema + checklist → independent verification (shape via validator, logic via the producing-agent's checklist applied by an independent reviewer) → done only when both implementation ∧ test pass.** Per-stage contracts are canonical in `${CLAUDE_PLUGIN_ROOT}/schemas/<stage>/*` (I/O) + `${CLAUDE_PLUGIN_ROOT}/shared/validators/validate-*.ts` (shape gate) + the agent's `## Verification checklist` (logical gate / prohibitions) + `${CLAUDE_PLUGIN_ROOT}/knowledge/guidelines/*-policy.md`.
