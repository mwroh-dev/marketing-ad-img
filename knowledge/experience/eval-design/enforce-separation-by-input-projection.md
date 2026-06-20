# Enforce role/concern separation by input projection, not by prompt warnings

**Symptom**: Two stages meant to analyze disjoint concerns (e.g. text vs. layout) leak into each other despite prompt instructions telling each to "ignore" the other's content. Leakage is hard to catch and contaminates downstream analysis.

**Root cause**: A prompt warning ("don't look at coordinates") is advisory — the model still *sees* the full input, so violation is possible and silent. Separation that depends on the agent's discipline is not structurally guaranteed.

**Rule**: Make cross-concern leakage structurally impossible by projecting the input: give the text analyst text-only (coordinates stripped) and the layout analyst geometry-only (content masked). When the agent never receives the other concern's data, it cannot violate the separation. Add a leaked-token FP scan as a second guard. This mirrors the orchestrator principle of projecting only role-relevant fields to each subagent.
