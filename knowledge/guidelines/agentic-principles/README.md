# Global Agentic Principles

Provider-neutral, system-agnostic. No brand, product, or category specifics belong here.

---

## Agents Are Contracts

An agent exposes a contract: defined inputs, defined outputs, defined scope.
- Scope creep inside an agent breaks the contract and makes the pipeline unreliable.
- If an agent needs to do something outside its contract, that is a signal to split the agent or
  redesign the pipeline, not to silently expand scope.

---

## Context Projection

The orchestrator holds the full context. Subagents receive only the role-scoped view they need.
- Passing full context to every subagent wastes tokens and introduces noise.
- Each handoff message should contain: goal, constraints, input artifact ref, output contract.
- Subagents must not assume context that was not explicitly passed.

---

## Memory Separation

- **Working memory:** in-context data for the current task. Ephemeral.
- **Structured memory:** persisted artifacts (YAML, JSON, Markdown) with a defined schema.
- **Knowledge:** distilled, durable principles. Slow to change. Lives in `${CLAUDE_PLUGIN_ROOT}/knowledge/`.
- Do not promote ephemeral working data into knowledge without deliberate review.

---

## Handoff = Structured Artifact

Agent-to-agent handoffs must be structured artifacts (JSON or YAML with a schema reference),
not free-text summaries.
- Free-text handoffs degrade silently when the receiving agent interprets them differently.
- Schema-validated artifacts make failures explicit and catchable.

---

## Completion Honesty

An agent must not declare completion unless the output artifact exists and conforms to its schema.
- "I would have done X" is not completion.
- Verification is the agent's responsibility, not the orchestrator's assumption.
