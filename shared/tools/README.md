# shared/tools

ToolSpec catalog and MCP exposure source of truth for deterministic callable boundaries in this
Claude Code-only plugin runtime.

This folder owns the bridge between existing `shared/` implementations and Claude Code's actual
`tools:` surface. P0 entries in `catalog.ts` are exposed through the plugin-bundled MCP server
declared in `${CLAUDE_PLUGIN_ROOT}/.mcp.json`; P1 entries remain catalog-only candidates.

## Product intent

- Reduce raw command/prose dependence in the orchestrator and mode runbooks.
- Keep agent prompts focused: the tool boundary lives in `ToolSpec`, not in long agent instructions.
- Make the existing `shared/` deterministic surface available to Claude Code as real MCP tools
  without renaming or relocating the underlying scripts/modules.
- Keep LLM judgment and creative reasoning as agents; only deterministic, schema-checkable, side-effect
  describable operations become tool candidates.

## Runtime layers

1. `shared/` — current scripts/modules/validators; implementation detail.
2. `shared/tools/catalog.ts` — public aggregate/re-export for the stable tool contract.
   `types.ts` owns shared ToolSpec types/helpers, and `definitions.ts` owns the tool definitions,
   MCP names, permissions, side effects, and current implementation references.
3. `shared/tools/mcp-bootstrap.mjs` — dependency bootstrap. It prepares `${CLAUDE_PLUGIN_DATA}` with
   runtime npm deps and a data-resident MCP adapter copy, so GitHub-installed plugins do not require
   `${CLAUDE_PLUGIN_ROOT}/node_modules`.
4. `shared/tools/mcp-server.mjs` — Claude Code MCP adapter for P0 tools.
5. `agents/*.md tools:` — actual Claude Code allowlists using the full MCP tool names.

## Runtime dependency placement

The plugin root is treated as shipped source. Do not rely on committed `node_modules`. The MCP command in
`${CLAUDE_PLUGIN_ROOT}/.mcp.json` launches `mcp-bootstrap.mjs`, which:

- installs runtime dependencies into `${CLAUDE_PLUGIN_DATA}`,
- copies `mcp-server.mjs`, `mcp-handlers.mjs`, `catalog.ts`, `definitions.ts`, and `types.ts` into `${CLAUDE_PLUGIN_DATA}/runtime`,
- starts the data-resident MCP server so ESM package resolution finds `${CLAUDE_PLUGIN_DATA}/node_modules`,
- keeps implementation paths pointed at `${CLAUDE_PLUGIN_ROOT}` and consumer state pointed at
  `${CLAUDE_PROJECT_DIR}`.

The `SessionStart` hook warms this runtime ahead of tool use; the bootstrap also performs the same preparation
when the MCP server starts, so a cold plugin data directory still fails closed instead of silently losing tools.

## Naming

Tool ids use `area_verb_object`, ASCII snake_case, and describe meaning rather than filenames.

Examples:

- `collection_run_flow`, not `run_flow_mjs`
- `analysis_validate_store`, not `validate_store_ts`
- `creative_change_detect_candidates`, not `detect_change_candidates_mjs`

## Eligibility

A shared operation can become a tool candidate when it is:

- deterministic or mechanically bounded,
- schema-checkable,
- side-effect describable,
- backed by a current implementation, or intentionally marked as a P1 candidate,
- useful as a callable boundary for the orchestrator or a named subagent.

The following stay out of the tool catalog:

- LLM judgment itself, such as `temporal-change-analyst` or `critic-verifier`,
- internal helpers such as `shared/collect/schema-validate.mjs`,
- flow adapter internals such as `define-flow` and `flow-registry`,
- templates and tests.

## ToolSpec fields

`catalog.ts` exports the typed source of truth; definitions are separated into `definitions.ts`
and shared types/helpers into `types.ts` so the aggregate file stays small as tools are added.

| Field | Meaning |
|---|---|
| `id` | Canonical tool id. |
| `mcp` | MCP exposure metadata: `exposed`, short MCP `name`, and full Claude Code `claudeCodeName`. |
| `title` | Short human label. |
| `description` | What it does and when it should be selected. |
| `stage` | Pipeline area: orchestration, collection, analysis, generation, reporting, lineage, asset. |
| `priority` | `P0` for current critical surface, `P1` for candidate/next-pass surface. |
| `inputSchemaRef` | Schema for call parameters when one exists. This is not the same as output artifact schema. |
| `outputSchemaRef` | Primary machine output schema when the tool writes or returns one artifact. |
| `artifactSchemaRefs` | All artifact schemas touched or produced by the implementation. |
| `sideEffects` | `read_only`, `write_state`, `move_files`, `serve_localhost`, `network_public`, `cdp_public_browser`, `spawn_chrome`, `audit_log`. |
| `requiresUserConfirmation` | True for tools that require a human decision before the side effect completes. |
| `callableBy` | Actual `agents/*.md` `name` values or `orchestrator`; no group aliases. |
| `preconditions` | Required state before call. |
| `failureModes` | Expected hard-stop or degrade reasons. |
| `currentImplementation` | Current script/module path and command shape. |

## P0 MCP catalog

Claude Code prefixes plugin tools as `mcp__plugin_marketing-img_m__<mcp.name>`.

| Tool id | MCP name | Current implementation | Notes |
|---|---|---|---|
| `state_check_project` | `state_check_project` | `shared/harness/check-state.mjs` | Reads consumer state and route. |
| `artifact_validate` | `artifact_validate` | `shared/validators/` | Validator family, not a single script. |
| `orchestration_validate_subagent_projection` | `handoff_validate` | `shared/harness/validate-subagent-projection.mjs` | General materialized-handoff guard. |
| `collection_run_flow` | `collection_run_flow` | `shared/collect/run-flow.mjs` | Public ad-library CDP lifecycle owner. |
| `collection_select_images` | `collection_select_images` | `shared/collect/select-images.mjs` | Localhost human review; moves unselected files to `_removed`. |
| `collection_screen_images` | `collection_screen_images` | `shared/collect/screen-images.mjs` | Mechanical size/dimension/duplicate screen. |
| `analysis_close_run` | `analysis_close_run` | `shared/harness/close-analysis.mjs` | Persists lineage store, freezes run creative snapshot, advances stage. |
| `analysis_validate_store` | `analysis_validate_store` | `shared/harness/validate-store.ts` | Provenance gate before generation and creative-change edge analysis. |
| `analysis_build_market_position` | `analysis_build_market_position` | `shared/collect/build-market-position.mjs` | Builds matrix, especially from durable store for generation. |
| `generation_normalize_artifact` | `generation_normalize_artifact` | `shared/harness/normalize-artifact.mjs` | Shape-only conformance for drift-prone generated artifacts. |
| `generation_finalize_candidates` | `generation_finalize_candidates` | `shared/harness/finalize-candidates.ts` | Deterministic prompt-candidate finalizer. |
| `generation_validate_run` | `generation_validate_run` | `shared/harness/validate-gen-run.ts` | Full generation conformance gate. |
| `recipe_serve_viewer` | `recipe_serve_viewer` | `shared/collect/validate-recipe.mjs` | Read-only local recipe QA viewer. |
| `report_aggregate_competitive_trend` | `report_aggregate_competitive_trend` | `shared/harness/run-competitive-trend.ts` | Competitive trend aggregation. |
| `report_render_competitive` | `report_render_competitive` | `shared/harness/render-report.mjs` | Deterministic competitive report renderer. |
| `creative_change_build_snapshot` | `creative_change_build_snapshot` | `shared/harness/build-creative-snapshot.mjs` | Snapshot from collection + durable store. |
| `creative_change_compare_snapshots` | `creative_change_compare_snapshots` | `shared/harness/compare-creative-snapshots.mjs` | Deterministic snapshot diff. |
| `creative_change_detect_candidates` | `creative_change_detect_candidates` | `shared/harness/detect-change-candidates.mjs` | Deterministic change candidates. |
| `creative_change_render_report` | `creative_change_render_report` | `shared/harness/render-change-report.mjs` | Validated escaped HTML renderer. |

## P1 candidates

P1 items are real candidate boundaries, but they are not required for the first handler/adapter pass.

- `collection_build_queries`
- `collection_refine_detail_cuts`
- `analysis_compute_bindings`
- `analysis_run_ad_type_gate`
- `analysis_run_keyword_model`
- `analysis_run_ad_pattern`
- `asset_cleanup_product_cutout`
- `lineage_record_logic_change`
- `lineage_list_stale_artifacts`
- `creative_change_evaluate_agent_output`

## Agent access

`callableBy` uses actual agent ids only. Deterministic P0 tools are orchestrator-owned in this PR, so
specialist subagents do not receive `mcp__plugin_marketing-img_m__*` tools. Do not add deprecated agents
such as `ad-image-screener`.
