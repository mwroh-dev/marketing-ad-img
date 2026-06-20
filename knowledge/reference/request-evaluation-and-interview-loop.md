# 02. Request Evaluation and Interview Loop

## Principle

The interview is not based on a number of questions.

The interview is a **criteria-driven state loop**.

```txt
User Request
→ Request Evaluation
→ Missing / Insufficient Slot Detection
→ Interview Agent asks next blocker-resolution question
→ User Answer
→ user-answer-tooling
→ Interview State Update
→ Request Evaluation again
→ Execute Mode only when criteria are satisfied
```

## Request Evaluator

The Request Evaluator evaluates the following every turn.

- current user request
- existing knowledge
- registry state
- interview-state
- previous user-answer artifacts
- requested mode
- required slots
- missing slots
- insufficient slots
- blockers
- next interview target

## Slot States

```txt
missing       = no value
insufficient  = a value exists but falls short of the mode execution bar
filled        = filled to an executable level
confirmed     = explicitly confirmed by the user
```

## Blocker Types

```txt
hard_block = mode cannot run
soft_block = it can run, but quality/accuracy degrades
```

A mode must not run if even one hard blocker exists.

## Interview Agent

The Interview Agent does not generate a list of questions.

Its role is to turn the currently most important blocker into a chained selection or free-response form that is easy for the user to answer.

## User Answer Tooling

Every user answer is processed immediately with user-answer-tooling.

It preserves the raw answer, produces a normalized answer, and records as an artifact which slots get updated.

One answer may update multiple slots.

## Interview Loop Policy

```yaml
interview_policy:
  control_type: criteria_driven
  fixed_question_count: false

  loop:
    - evaluate_request
    - detect_missing_or_insufficient_slots
    - select_highest_priority_blocker
    - ask_user_for_blocker_resolution
    - process_answer_with_user_answer_tooling
    - update_interview_state
    - rerun_request_evaluation

  termination:
    success:
      - all_hard_blockers_resolved
      - required_slots_filled_or_confirmed
      - mode_state_ready
    stop:
      - user_cancelled
      - source_permission_unclear
      - requested_action_out_of_scope

  answer_policy:
    every_answer_must_create_artifact: true
    raw_answer_must_be_preserved: true
    normalized_answer_required: true
    one_answer_may_update_multiple_slots: true
    do_not_update_knowledge_without_structured_answer: true
```

## Example Request Evaluation Output

```json
{
  "mode": "image_generation",
  "execution_status": "blocked",
  "blockers": [
    {
      "blocker_id": "missing_product_asset",
      "severity": "hard_block",
      "slot_ids": ["product_asset_id"],
      "reason": "No raw or cutout product image is registered."
    },
    {
      "blocker_id": "weak_persona_specificity",
      "severity": "soft_block",
      "slot_ids": ["persona_id", "persona_context"],
      "reason": "Persona exists but is not specific enough for candidate differentiation."
    }
  ],
  "next_interview_target": "missing_product_asset"
}
```
