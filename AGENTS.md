# AGENTS.md

Entry instructions for AI coding agents (Codex, etc.) doing **development work on this repo**. Per the [agents.md](https://agents.md) convention this file is read first — so it points you to the real sources instead of duplicating them.

> This repo is the `generate-img` (marketing-img) **Claude Code plugin** — a prompt-only ad-image creative-prompt system. This file is for agents *editing the codebase*. It does NOT run the product; the product's runtime entry is the `orchestrator` agent.

## Start here
- **`CLAUDE.md`** (repo root) — the dev context loader + orchestrator operations manual. Read first for how the system is structured and how to work in it. (Note: a plugin's root `CLAUDE.md` is dev-only — it is NOT loaded for consumers when the plugin is installed elsewhere.)
- **`agents/orchestrator.md`** — the shipped runtime entry agent (auto-activated via `settings.json`). The product's behavior lives here, not in this file.
- **`knowledge/reference/subagent-projection.md`** — the subagent **projection table** (Context Distribution Rule), real-subagent ↔ stage map, agent-design principle, handoff rule. *(This is what previously lived in this AGENTS.md.)*

## Conventions for editing
- Agents are **contracts, not code** — authoring standard in `knowledge/reference/agent-authoring-standard.md`.
- Hard constraints are single-owned in `knowledge/reference/non-negotiable-rules.md` — do not restate them elsewhere.
- Every `${CLAUDE_PLUGIN_ROOT}/<path>` reference must resolve; `shared/check-refs.mjs` (run via the test suite) fails CI on a broken/renamed ref.
- Completion is decided by **independent verification** (`knowledge/guidelines/completion-verification-policy.md`), never self-declaration.
