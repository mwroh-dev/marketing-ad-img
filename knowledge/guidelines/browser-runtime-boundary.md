# 04. Browser Runtime Boundary

## Runtime Roles

| Tool | Role |
|---|---|
| agent-browser | The LLM directly explores a new browser source |
| browser-flow | Capture/analyze/generate/verify/reuse a repeatable browser workflow |
| marketing-img | domain orchestration, registry, knowledge, creative candidate generation |

## agent-browser

Use for:

- Inspecting the UI structure of a new source
- Locating accessible data
- Checking screenshot/snapshot/text
- Exploring candidate flows

Do not use for:

- Repeated execution
- Storing a verified workflow
- Replacing browser-flow
- Bypassing access control
- captcha/lock bypass

## browser-flow

`browser-flow` is a project-local skill installed in `.claude`.

Use for:

- human-demonstrated workflow capture
- sanitized artifact persistence
- analyze/generate/verify
- repeatable flow reuse
- browser-flow default artifacts

Do not:

- copy browser-flow internals into marketing-img
- reimplement capture/replay
- store credentials in marketing-img
- make cross-machine session support in MVP

## Login Session Model

```txt
human logs in once
→ browser profile is bound to local CDP port
→ agent only knows profile id / port id
→ agent does not receive credential
```

This does not mean the agent has no authority. It means credential is not exposed. Therefore minimal authority boundary is still required.

## Minimal Authority Boundary

```yaml
authority_policy:
  allowed_domains: []
  allowed_actions:
    - read_visible_text
    - click_navigation
    - search_or_filter
    - paginate
    - screenshot
    - download_allowed_export
  forbidden_actions:
    - purchase
    - delete
    - edit_product
    - reply_to_customer
    - send_message
    - change_price
    - change_inventory
    - submit_form_with_business_effect
```

## Security Scope

This project does not build enterprise security infrastructure.

It still keeps:

- credential non-exposure
- local-only profile assumption
- allowed domain metadata
- forbidden action metadata
- repeat verification
- artifacts
- no stealth/bypass/captcha-solving functionality

## Block response handling (STOP, no workaround)

On a block/verification response, no hackier workaround — stop immediately. No URL/query-string assembly, DOM value injection, or synthetic submit. `isBlocked()` in `${CLAUDE_PLUGIN_ROOT}/shared/collect/lib.mjs` detects block pages and the collector halts there.

## Navigation entry-point rule (every starting point is search)

Act like a human: **enter the tool home → search → click a result to enter.** Do not jump to a deep link by typing the URL directly.

- **Direct entry allowed (homepage level)**: the site origin. This level is a normal page people share and access.
- **Forbidden (hacky deep link)**: result/pagination paths (two or more segments), query-string/hash-assembled URLs on a general site. Navigating directly to such URLs is not a human flow.
- **Enforcement point**: `gotoRoot()` in `lib.mjs` reduces the passed-in URL to the origin — deep/query URLs are structurally trimmed to the origin. A specific result must be reached only via **search → click**.
- **Public-tool front-door exception (whitelist)**: the *first page* of a public ad-transparency tool (e.g., Meta Ad Library `facebook.com/ads/library`, Google Ads Transparency) is the tool's entrance, not a result deep-link. Only URLs registered in `config/tool-entrypoints.yaml` can be entered via `gotoTool()` in `lib.mjs`, and it always navigates to the registered clean URL (no parameter assembly). Inside the tool, only real search-and-click.

## Non-intrusive principle (no mouse/focus stealing)

CDP automation **must never steal the user's physical mouse cursor or keyboard focus** — the user must be able to do other things concurrently while automation runs. (Global rule: `~/.claude/rules/cdp-non-intrusive.md`)
- CDP `Input.*` events are delivered only to the page renderer and do not move the OS physical cursor — this is how we click/type "like a human."
- **Forbidden**: `Page.bringToFront()` / `Target.activateTarget()` (focus stealing), opening a new tab in the foreground, navigating the active tab the user is viewing, OS-level input automation (AppleScript/cliclick/robotjs).
- **Enforcement point**: automation runs only in a background tab created by `openBackgroundTab()` in `lib.mjs` (= `Target.createTarget({background:true})`). It does not navigate the user's active page via `connect()`. (The collectors will migrate to this background pattern — the current collect-* are a follow-up.)
- **A dedicated headless instance is best for public sources** (live-proven): background tabs do not paint, so `captureScreenshot` hangs. So public sources (no login required, e.g., Meta Ad Library) run in a **dedicated headless Chrome instance** (separate port / `--user-data-dir`) — no window means focus cannot be stolen, yet it still renders. Images are fetched via `Network.getResponseBody` (already-loaded cached bytes, independent of CORS/paint). Automation tabs/instances are cleaned up via finally + a hard timeout even on failure (no orphan-tab accumulation).

## Public transparency tool filter URL exception

A **filter URL** of a public **ad transparency library** (Meta/Google/TikTok) (e.g., `…/ads/library/?ad_type=all&country=KR&media_type=image&q=…`) is that tool's *public filter interface*, so it is allowed — it differs from a product/result deep-link (no bot wall, public). Only for public libraries registered in `config/tool-entrypoints.yaml` may that library's documented filter parameters be used in navigation. Assembling search-result/product URLs on a general site is still forbidden (the gotoRoot rule is unchanged).
