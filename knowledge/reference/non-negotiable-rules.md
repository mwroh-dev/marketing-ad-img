# Non-negotiable Rules

The project's hard constraints (formerly MEMORY.md). These bind every agent/skill/script.

- Actually running ads or calling a real image provider (ChatGPT/Gemini) is out of MVP scope. The adapter produces only the prompt + verification checklist.
- The canonical path for data collection is the **public ad-transparency libraries (Meta Ad Library, Google Ads Transparency)** — intended-public, no login — accessed through a CDP browser. Detail cuts are analyzed only from the seller's **own / user-provided images** (via the image refiner), never collected from third-party stores. What is forbidden is bypassing, stealth, captcha solving, assembling URLs/query strings, DOM value injection, and synthetic submit; on a block/verification page, STOP immediately (no hackier bypass). Any credentials are never exposed to agents/artifacts — access is via profile_id/port only.
- `browser-flow` is used only as a `.claude` skill. Artifacts use the browser-flow default storage structure, and `marketing-img` references them only via `.generate-ads-img/registry/promoted-flows.yaml` metadata.
- Login credentials/cookies/tokens/passwords are not exposed to agents and not stored in artifacts. Login profiles are accessed only via the local-only CDP port/profile registry.
- Do not build a mode CLI. `${CLAUDE_PLUGIN_ROOT}/shared/` (validators/harness) is for validation/harness purposes.
- Product cutout/cleanup is included from the start as a Node script (no Python).
- Korean copy is rendered by the image model itself. The adapter prompt preserves the exact Korean headline/subcopy/CTA verbatim.
- 4 candidates by default, expandable to 1–12 via schema.
- Brand 1 → Product N → Persona N. Do not flatten.
- Do not mix Global Knowledge and Domain Knowledge.
- **Domain is never pre-fixed.** The product, persona, competitors, keywords, and ad copy for a run come ONLY from THAT run's projected input / collected data. No agent, contract, guideline, or script may assume a specific domain (e.g. study/timer), hardcode a brand/persona/product, or carry an example value into output. Examples in any contract are illustrative across domains only — never the assumed domain. (Pre-fixing a domain causes hallucination.)
- Every subagent receives only a role-scoped projected view. Only the orchestrator holds the full artifact/knowledge set.
- Every interview answer is stored as a structured artifact via `user-answer-tooling`. Do not turn raw text directly into domain knowledge.
- The interview is a state loop based on criteria satisfaction, not on a question count. A mode does not run before request-evaluation says ready.

## Backlog (not implemented in MVP)
- **Performance learning**: do not implement an active performance-learning loop in the MVP. Only keep `candidate-selection-log` schema-compatible with future learning (feeding ad-performance data back into candidate generation). (Formerly the `performance-learning` skill — a rule, not a procedure.)
