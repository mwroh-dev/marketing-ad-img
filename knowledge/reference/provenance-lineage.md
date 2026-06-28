# Provenance & lineage — the analysis/generation memory (NORTH STAR)

The design reference for **how every analysis and generation artifact remembers what produced it**, so a human
review can ask "why is this like this?", compare an item against its peers, decide whether one item or a whole
shared pattern is wrong, and re-run the right path. This is the north star; it is realized incrementally (see
"Build order"). Nothing here is performance-learning (`non-negotiable-rules.md` still binds).

## Why this exists (the human-review loop it serves)
1. In `validate-recipe`, the human compares **their ad + the recipe we extracted** against **our prompt-generated
   image** built from that recipe.
2. Something doesn't match. The human copies the item's id and asks the agent **"이거 왜 이래?"**.
3. The agent must **walk that item's full chain** — for a competitor ad: image→perception(OCR-first)→copy/layout/
   visual/intent→strategy→ad-type; for our image: ad-pattern/matrix→opportunity→brief→copy→prompt — and **compare
   the item against its peers** (items built with the same shared pattern/layer) to localize the fault.
4. The human judges: **everything of that kind is wrong** (the shared logic is flawed) **or only this one is**.
5. The fix is a change to the **shared analysis/generation logic** (an agent contract, a taxonomy row, a rule, code)
   — which is a **git commit**. Then re-run: competitor items are **re-analyzed**, our items are **re-generated**.

A mis-analysed ad is a *symptom*; the real event is usually fixing the *shared logic*, which ripples across every
item produced with it. So the memory must be **global** (not run-siloed) and must record **which logic version**
produced each item, so a logic change can flag what is now stale.

## The two layers
### Layer A — the lineage store (global, persona-keyed)
Every artifact is wrapped in a **lineage envelope** and lives in `STATE_DIR/store/{persona_id}/…`. The run is just
provenance (`key.run_id`); the artifact's identity is the **ad** (`persona_id` + `image_ref`) or the **candidate**
(`persona_id` + `candidate_id`). The envelope carries:

| field | meaning |
|---|---|
| `kind` | perception · copy · layout · visual · intent · strategy · ad-type · ad-type-gate · bindings · opportunity · brief · candidate |
| `key` | `{persona_id, image_ref?, candidate_id?, run_id?}` — identity + provenance of where it came from |
| `pattern_tag` | the **shared pattern** this item belongs to → its **peers** (siblings). Analysis: `{ad_type}:{benefit}×{funnel}`. Generation: the opportunity position. Same `pattern_tag` = made the same way. |
| `derived_from[]` | the **chain** — refs to the parent envelopes this was built from (the machine-resolvable lineage that was only implicit via `image_ref` before) |
| `logic_version` | `{version, method:git\|content, dirty?}` — **which version of the shared logic produced it** (git sha of the plugin, or a content-hash fallback for a shipped non-git plugin) |
| `produced_by` | the agent/script that emitted it |
| `stamped_at` | when it was persisted |
| `payload` | the artifact itself (conforms to its own `schemas/…` schema) |

### Layer B — the audit / logic-change log (global) [#2, after #1]
A correction is a change to shared logic, so the log records **logic changes**, not per-ad edits:
`{ trigger_ad, finding, qa_log, commit_sha, impact:[stale artifacts] }`. The as-is→to-be→diff of the *logic* **is the
git commit** — we reuse git rather than build a diff engine; the log adds the human-provenance layer (which finding,
which commit, what it makes stale). This is the structured, global, first-class form of `tasks/lessons.md` +
`grounds_in` + the agentic-principles "case-law" discipline.

## The six behaviors the two layers enable
1. **"왜 이래?"** — walk the envelope's `derived_from` chain back to the pixels / inputs.
2. **Peer comparison** — group by `pattern_tag`; siblings made the same way are compared to localize the fault.
3. **"all wrong vs only this"** — the human's verdict sets the **impact scope** of the logic change.
4. **Staleness** — when `logic_version` changes, artifacts stamped with the old version (in the touched scope) are
   flagged stale. **Flag only — never auto re-run** (cost + human-in-loop); the human chooses what to re-run.
5. **Two re-run paths** — competitor item → re-analyze; our item → re-generate the prompt.
6. **Dual comparison view** — `validate-recipe` reads the store to show *theirs (recipe)* and *ours (generated)* side
   by side. (The viewer still NEVER pre-grades quality — the human judges; see `modes/validate-recipe.md`.)

## What this reuses (not reinvented)
- `image_ref` (basename) is already the per-image join key across analysis artifacts; `persona_id` the grouping.
- The analysis→generation chain already exists (matrix→opportunity→brief→copy→adapter) — `derived_from` makes it a
  machine-resolvable foreign key instead of the current free-text `source_matrix_evidence`/`evidence_refs`.
- `grounds_in` / `evidence` / `copy.source_id` stay as theory/anti-hallucination provenance *inside* a payload;
  the envelope adds the *cross-artifact* lineage they never had.
- **git** is the as-is/to-be/diff of the logic (Layer B). `STATE_DIR`/`statePath` (`shared/_lib.ts`) is the one base
  dir for the store (today three inconsistent write roots exist — the store standardizes on STATE_DIR).

## Build order (incremental — north star fixed, realized in steps)
1. **#1 lineage persistence (foundation)** ✅ — `schemas/lineage/artifact-envelope.schema.json` + the global store +
   `shared/lineage/logic-version.mjs` + `persist-artifact.mjs` (+`migrate-pilot.mjs` proof); `validate-recipe` reads
   the store.
2. **#2 audit/logic-change log** ✅ — `schemas/lineage/logic-change.schema.json` + `shared/lineage/logic-change-log.mjs`
   (trigger→finding→qa→commit→impact) on top of `shared/lineage/staleness.mjs` (flag-only).
3. **Live wiring** — the analysis runbook now persists each artifact to the store via `persistArtifact`
   (`modes/analysis.md` Outputs); the correction loop is `modes/validate-recipe.md` step 3. Exercised on real runs;
   the helpers are proven on pilot data.
4. **Generation-side lineage + the dual (theirs+ours) comparison view** ✅ — the envelope supports
   `opportunity`/`brief`/`candidate` kinds + `generationPatternTag`; `validate-recipe` renders our generated items
   (with their lineage) in a "우리 생성물" section alongside the competitor recipes. (Live generation persistence —
   `finalize-candidates` writing candidates to the store — is wired the same way as analysis, exercised on real runs.)
