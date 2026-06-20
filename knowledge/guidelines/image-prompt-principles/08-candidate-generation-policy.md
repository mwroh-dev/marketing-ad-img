# 08. Candidate Generation Policy

## Candidate Count

Default candidate count is 4.

It must be schema-configurable for future expansion.

```yaml
candidate_count:
  default: 4
  minimum: 1
  maximum: 12
```

## Candidate Generation Inputs

Candidate generation may consider:

- user request
- brand goal
- product USP
- product claims
- persona
- review signals
- competitor ad patterns
- category patterns
- global marketing techniques
- global copywriting techniques
- global layout principles
- selected ad formats
- product asset status
- image adapter capabilities

However, each subagent receives only the projected view it needs.

## Default Candidate Diversification

Default 4 candidates should be diversified by angle:

```txt
Candidate 1: Product-driven
Candidate 2: Persona-driven
Candidate 3: Copy-driven
Candidate 4: Layout-driven
```

This is a default diversification strategy, not a hard-coded rule. The orchestrator may choose a different distribution if user request or data signals require it.

## Candidate Selection Log

Every run must create a selection log.

```json
{
  "run_id": "creative_001",
  "candidate_count": 4,
  "selection_strategy": "diversified_by_angle",
  "candidates": [
    {
      "candidate_id": "candidate_001",
      "angle": "product_usp",
      "primary_variable": "product",
      "reason": "Product differentiation is the strongest available signal."
    }
  ]
}
```

## Candidate Quality Gate

Each candidate must include:

- candidate_id
- selected format
- selected angle
- target product
- target persona
- copy
- layout
- provider-neutral spec
- adapter outputs
- verification checklist
- evidence refs or assumption notes
- risk notes
