# marketing-img

**A Claude Code plugin that turns your product + a few pointers into 4 ad-image PROMPT candidates** — prompts you
run in ChatGPT/Gemini together with your own product photo. It never generates an image itself.

| Key fact | |
|---|---|
| **Output** | 4 image-**PROMPT** candidates (configurable 1–12). **Prompt-only** — no image is ever generated, no provider is called. |
| **The prompt** | composes a scene **WITH the user's attached product photo as the fixed hero** (placed / used, never regenerated). |
| **Domain** | **domain-neutral** — brand/product/persona is configured per consumer at setup (a specific seller is one instance, not the definition). |
| **How decisions are grounded** | **user pointers + parallel real-data research** (the product page, public reviews, real category ads) — never a guess. |
| **Ad data sources** | public ad-transparency libraries only: **Meta Ad Library + Google Ads Transparency** (no login). Commerce stores = public review reading only, never scraping. |
| **Entry** | the `/marketing-img:start` command → the `orchestrator` agent routes to the right mode. |
| **Verification** | every stage is gated by independent verification (schema shape + the agent's logical checklist on real output); self-declaration is never accepted. |

## Entry

```
/marketing-img:start <what you want — set up our brand / collect category ads / make prompt candidates>
```

The `orchestrator` agent routes the request and dispatches role-scoped subagents. (`CLAUDE.md` is a DEV reference
only — it is NOT loaded for consumers.)

## Pipeline (the modes the orchestrator routes into)

| Mode | Input | What it does | Output |
|---|---|---|---|
| **initial-setup** | brand · product · product URL · **target market (domestic/overseas)** | data-first synergy: collect pointers → announce "Now researching in parallel" → fan out `brand-researcher` (page / reviews / positioning) → present data-derived category + persona **candidates as choices** (never free-form). | confirmed brand / product / persona state |
| **data-collection** | persona · target market | **Track 1 (primary, ungated)**: broad category/keyword ad corpus (Meta keyword search). **Track 2 (optional)**: competitor enrichment (`discovery-scout` → `competitor-curator` HARD GATE). After collection: **human keep/delete review** (1st-pass) → deterministic `screen-images.mjs` (size/dup) before analysis. Real CDP · non-intrusive · STOP-on-block. | collected ad images + manifest (provenance: source · query · counts · gaps) |
| **analysis** | screened ad images | `perception-extractor` → (stitch+bind) → `ad-type-classifier` → `copy-analyst` ⊥ `layout-analyst` ⊥ `visual-analyst` → `intent-analyst` → `strategy-projector` → `ad-analyst` → (market-position-aggregate) → `pattern-synthesizer`. | ad-pattern + market-position matrix + keyword model |
| **image-prompt generation** | brand/product/persona · analysis signals · the product photo | `creative-opportunity-mapper` (ring 3) → `creative-brief-analyst` → `copy-layout-planner` → `image-prompt-adapter` → `critic-verifier` → finalize. Composes WITH the product photo; Korean copy preserved byte-for-byte. | **4 prompt candidates** (ChatGPT + Gemini) |

## Install

**Prerequisites:** Node ≥ 20 · a local **Chrome/Chromium** (the collection mode drives it via CDP; set `CHROME_BIN` if it's in a non-standard path). macOS/Linux (the launcher uses `lsof`/`curl`).

```bash
# from a git repo (clone = a real copy):
claude plugin marketplace add github.com/mwroh-dev/marketing-ad-img
claude plugin install marketing-img@mwroh-dev
# …or local dev:
claude --plugin-dir /path/to/marketing-ad-img

# one-time: the collection/validation scripts need node deps (run in the plugin dir)
npm install     # ajv, ajv-formats, yaml, chrome-remote-interface, tsx (+ optional sharp)
```

- Assets resolve via `${CLAUDE_PLUGIN_ROOT}` → the plugin runs from any working directory.
- Consumer state (brands, runs, collected ads) is written to `./.generate-ads-img/` in your project (gitignored).

> **Three names, on purpose.** The **repo** is `marketing-ad-img`, the **plugin** (and command namespace `/marketing-img:start`) is `marketing-img`, and the runtime **state directory** is `./.generate-ads-img/`. They are intentionally distinct: the repo hosts the plugin, the plugin name drives the command, and the state dir is per-consumer working data.

## Structure

```
.claude-plugin/{plugin.json, marketplace.json}    plugin manifest + marketplace
settings.json                                     "agent": "orchestrator" (default/entry agent)
commands/start.md                                 /marketing-img:start — the single entry command
agents/ (flat .md)                                orchestrator + 22 role-scoped subagents
skills/ (2)                                       reusable skills (agent-browser-exploration, user-answer-tooling)
knowledge/  guidelines ⊥ experience ⊥ reference   principles · learned patterns · mode runbooks + design refs
schemas/ (39, JSON Schema 2020-12)                I/O contracts per stage
shared/  collect · harness · validators · _lib    CDP collection, deterministic logic, schema validators
flows/ (meta-ad-library, google-ads-transparency) per-source CDP collection adapters (defineFlow)
config/ (cdp-ports, image-adapters, tool-entrypoints)
AGENTS.md                                         subagent projection table (what each receives / must not)
CLAUDE.md                                         DEV reference — NOT shipped/loaded for consumers
```

### The 22 subagents (by stage)
- **evaluation** — `request-evaluator`, `interview-controller`
- **setup** — `brand-researcher`
- **collection** — `discovery-scout`, `competitor-curator`, `ad-creative-refiner` (post-collection keep/drop is a human review + deterministic `screen-images.mjs`, no LLM)
- **analysis** — `perception-extractor`, `ad-type-classifier`, `copy-analyst`, `layout-analyst`, `visual-analyst`, `intent-analyst`, `strategy-projector`, `ad-analyst`, `pattern-synthesizer`
- **generation** — `creative-opportunity-mapper`, `creative-brief-analyst`, `copy-layout-planner`, `image-prompt-adapter`, `critic-verifier`

## Hard rules (single-owner: `knowledge/reference/non-negotiable-rules.md`)
- **Prompt-only** — never generate an image or call a provider.
- Ad creatives only from **public ad-transparency libraries** (Meta/Google); commerce stores = public review reading only, no scraping.
- **Non-intrusive CDP** — dedicated headless Chrome, background tabs, never steal the user's cursor/focus; **STOP on block**, no bypass/stealth/captcha/URL-assembly/DOM-injection.
- Credentials never in artifacts (reference `profile_id` / port only).
- Completion = independent verification, never self-declaration.

## Responsible use
- **Public data only.** Ad creatives are collected from public ad-transparency libraries (Meta Ad Library, Google Ads Transparency) that require no login. Commerce stores are used for **public review reading only** — never scraped.
- **You are responsible for compliance** with each site's Terms of Service and applicable law in your jurisdiction. This tool does not bypass blocks, captchas, or auth — it **stops on a block** by design.
- **No affiliation.** Not affiliated with, endorsed by, or sponsored by Meta, Google, or any ad platform. Trademarks belong to their owners.
- Provided **as is, without warranty** (see `LICENSE`).

## Status
- **Verified in dev runs** on real data: Meta/Google ad collection (real images) → analysis → 4 critic-passing prompt candidates. Not yet independently reproduced/CI-gated.
- **Provisional (`0.1.0-alpha`)** — gathering real user feedback before stabilizing.
- Behavior is driven by **agent contracts (markdown) + mode runbooks** — it evolves by editing those.
