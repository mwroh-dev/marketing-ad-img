# creative-change-analysis eval seeds

Fixture root:

```txt
shared/evals/creative-change-analysis/fixtures/
```

Each case should grow toward:

```txt
case-name/
  input/
    snapshot-a/ad-creative.json
    snapshot-a/store/
    snapshot-b/ad-creative.json
    snapshot-b/store/
    context-calendar.json
  expected/
    creative-snapshot-a.json
    creative-snapshot-b.json
    creative-diff.json
    change-candidates.json
    interpreted-change-events.assertions.json
  agent-sheet.md
```

Current deterministic tests keep compact inline fixtures in:

```txt
shared/collect/creative-snapshot.test.mjs
shared/collect/creative-diff.test.mjs
shared/collect/change-candidates.test.mjs
shared/harness/render-change-report.test.mjs
```

The `agent-sheet.md` files are the agent eval contract for `temporal-change-analyst`. They define what must be said,
what must not be said, required claim kinds, number fidelity, and pass criteria.

Programmatic eval support lives in:

```txt
shared/collect/creative-change-agent-eval.mjs
```

Use it after the agent writes `interpreted-change-events.json` and `creative-change-report.json`. It validates schemas,
candidate-id references, number fidelity against deterministic inputs, no-context inferred gating, and positive
performance/causality/persona overclaims while allowing explicit disclaimer wording.
