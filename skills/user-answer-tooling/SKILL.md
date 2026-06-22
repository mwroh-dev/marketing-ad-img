---
name: user-answer-tooling
description: Convert each raw interview answer into a structured user-answer artifact and update interview-state slot values.
---

# Structuring an interview answer

Every interview answer passes through this skill. Its job is to turn ONE messy
human reply into a clean, schema-valid `user-answer` artifact and a set of slot
updates that feed the interview loop. Get this wrong and the interview either
loops forever (under-resolving) or walks off a cliff (inventing values the user
never said).

## When to use it

Use this the moment the interview-controller hands you a raw answer for the
current `active_blocker`. One call = one answer = one artifact. If there is no
active blocker, there is nothing to structure — stop and report back.

## The method, step by step

1. **Capture the raw text verbatim, first.** Before any interpretation, store
   the user's literal reply as `raw_answer`. Never paraphrase, trim, or
   "clean up" — the verbatim text is the audit trail and the only defense if a
   later step over-interprets. Everything else is derived; this is the source.

2. **Read intent against the blocker, not in a vacuum.** You already know what
   was asked (`active_blocker.{slot, type, question}`). Read the answer *as a
   response to that question*. "Both Meta and Google" against "Which ad source
   would you like to use?" clearly resolves the source slot — even though it names no schema
   keyword. Map meaning, not surface strings.

3. **Map to slot(s).** Most answers fill the one blocker slot. But a single
   answer can legitimately resolve several — "Female, 30s, skin-brightening functional cosmetics
   seller" answers persona-age, persona-gender, and product-category at once.
   Emit one `normalized_slot_updates` item per slot the text *clearly* covers.
   Do not stretch one phrase across slots it only vaguely implies.

4. **Assign a resulting_state to each slot — this is the load-bearing judgment.**
   For every slot you touch, decide how settled it is:
   - `confirmed` — unambiguous AND complete. The user left no room for a
     follow-up. Reserve this; it ends the blocker.
   - `filled` — a clear value is present but a light confirmation is still
     reasonable.
   - `insufficient` — the answer gestures at the slot but the evidence is
     partial ("cosmetics, roughly" with no sub-category). Keep the partial value,
     mark it insufficient — the interview will ask one more targeted question.
   - `missing` — empty or non-answer ("I don't know", ""). Do not fabricate a value.

5. **Write the artifact and validate.** Build the `user-answer` artifact
   (`answer_id`, `run_id`, verbatim `raw_answer`, `for_blocker.{slot,question}`,
   `normalized_slot_updates[]` with optional `evidence_refs[]`) and validate it
   against `schemas/evaluation/user-answer.schema.json` *before* writing. An
   invalid artifact must never land on disk; fix the violation and re-validate.

6. **Emit the updated interview-state candidate.** Apply the slot updates,
   recompute `active_blocker` (cleared if the blocker is now confirmed; moved to
   the next unmet slot otherwise), and **append** a `history[]` entry
   (`answer_ref` + `slots_updated[]`). Append only — never overwrite prior
   history. This is what closes the loop: the controller reads the new state and
   either asks the next question or proceeds.

## Judgment calls

- **"Is this confirmed or just filled?"** Ask: could a reasonable follow-up
  still change this value? If yes, it is `filled`/`insufficient`, not
  `confirmed`. Over-confirming silences questions the interview should still ask.
- **"One slot or several?"** Only split across slots when the text *names or
  unmistakably entails* each one. Co-occurrence in a sentence is not evidence;
  meaning is.
- **"Ambiguous which slot?"** When one phrase could resolve slot A or slot B but
  not clearly either, emit separate `normalized_slot_updates` items and mark
  each `insufficient`. Let the next question disambiguate — don't guess.
- **"The user volunteered more than I asked."** Capture it as additional slot
  updates if it clearly resolves other slots; otherwise leave it in the verbatim
  `raw_answer` and don't force it into a slot.

## Pitfalls and how to avoid them

- **Over-interpretation / inventing values.** The cardinal sin. Never infer a
  slot value the raw text does not explicitly support. "I'm a cosmetics seller" does
  not tell you the target age — leave persona-age `missing`, do not assume.
- **Paraphrasing the raw answer.** Destroys the audit trail and lets drift creep
  in across turns. Store it byte-for-byte.
- **Writing to the wrong place.** This skill only touches the run's interview
  artifacts. NEVER update registry or domain-knowledge files (personas, brands,
  products) directly from raw text — those are downstream, post-confirmation.
- **Over-confirming to end the interview early.** Marking something `confirmed`
  to dodge another question produces a wrong brief downstream. Prefer
  `insufficient` when in doubt.
- **Overwriting history.** Always append; the history is the reconstruction
  trail for the whole interview.

## Worked illustration

- `active_blocker`: `{ slot: "persona", question: "Who is your target customer?" }`
- `raw_answer`: `"Women in their 30s who are office workers and looking for sensitive-skin cosmetics"`

Read against the blocker, this clearly resolves several persona facets:

```
normalized_slot_updates:
  - { slot: persona.age,        value: "30s",              resulting_state: filled }
  - { slot: persona.gender,     value: "female",           resulting_state: confirmed }
  - { slot: persona.occupation, value: "office worker",    resulting_state: filled }
  - { slot: persona.need,       value: "sensitive skin",   resulting_state: filled }
```

`gender` is unambiguous → `confirmed`. The others are clear but a light
confirmation pass is still reasonable → `filled`. Note what we did NOT do: we
did not invent a product brand, price tier, or buying occasion the user never
mentioned. The verbatim `raw_answer` is stored intact; a `history[]` entry is
appended; `active_blocker` advances to the next unmet slot. The controller now
decides whether to confirm the persona or probe the remaining gaps.
