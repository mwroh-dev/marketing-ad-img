# ${CLAUDE_PLUGIN_ROOT}/knowledge/experience — experience (reusable patterns learned from runs)

**Distinct from guidelines**: guidelines are *a priori* principles (brand-agnostic, known before building). Experience is *a posteriori* learning — patterns generalized from real runs/analyses that have become **reusable**.

**Distinct from consumer state (`.generate-ads-img/`)**: state is *one consumer's* brands·competitors·collected ads (per-consumer, not included in the release). Experience is cross-cutting knowledge distilled across many runs·brands and **persisted in the plugin**.

What goes here (examples):
- Layout·hook·copy patterns repeatedly confirmed per category/persona
- "What worked" (performance learning) generalizations
- Operational learnings such as per-source collection pitfalls/no-workaround boundaries

Fill it by distilling as runs accumulate. (Per-consumer sources stay in state; only generalized results come here.)

## Anti-pattern registry

Each file below is one declarative, brand-agnostic anti-pattern rule in **Symptom → Root cause → Rule** form, distilled from real-run execution learnings. Per `failure-logging-anti-survivorship-bias`, these record failures that any run could hit again — so the fix loads with the agent instead of being relearned.

### `cdp-collection/` — CDP automation & per-source collection
- [headless-mousewheel-never-acks](cdp-collection/headless-mousewheel-never-acks.md) — headless Chrome `mouseWheel` never acks → JS `scrollBy`; bound every step with a timeout
- [pgrep-self-match-deadlock](cdp-collection/pgrep-self-match-deadlock.md) — `pgrep -f` matches the watcher's own wrapper → run a synchronous chain, not a poll
- [cdn-images-use-getresponsebody](cdp-collection/cdn-images-use-getresponsebody.md) — CDN image bytes via CDP `Network.getResponseBody`, not fetch/canvas/screenshot
- [dedicated-headless-for-non-intrusive-collection](cdp-collection/dedicated-headless-for-non-intrusive-collection.md) — dedicated headless Chrome resolves "render vs. focus-steal"; `finally`-close tabs
- [no-deep-link-real-search-by-name](cdp-collection/no-deep-link-real-search-by-name.md) — deep-link URL trips the bot-wall → enter by real search-then-click; STOP on block
- [lazy-detail-images-need-real-expand](cdp-collection/lazy-detail-images-need-real-expand.md) — lazy detail images need real expand+scroll; extract from DOM nodes, not page text

### `validation/` — schema & contract validation
- [draft-2020-12-needs-ajv2020](validation/draft-2020-12-needs-ajv2020.md) — draft 2020-12 needs `Ajv2020`; memoize compile by `$id`
- [no-doc-keys-under-additionalproperties-false](validation/no-doc-keys-under-additionalproperties-false.md) — no `_note`/doc keys in data under `additionalProperties:false`
- [drop-in-claim-needs-canonical-validator](validation/drop-in-claim-needs-canonical-validator.md) — "drop-in" claims must pass the consumer stage's canonical validator (Ajv regression)

### `eval-design/` — concern separation & data thoroughness
- [grep-repo-before-concluding-no-data](eval-design/grep-repo-before-concluding-no-data.md) — grep the whole repo (incl. `.generate-ads-img/runs/*`) before concluding "no data"
- [enforce-separation-by-input-projection](eval-design/enforce-separation-by-input-projection.md) — enforce concern separation by input projection, not prompt warnings

### `workflow/` — git & process
- [branch-after-merge-before-next-work](workflow/branch-after-merge-before-next-work.md) — branch right after a merge; verify branch state before reporting "merged"
