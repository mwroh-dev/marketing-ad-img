# 05. Ad-Source Adapter Contract (canonical)

> A contract for plugging in a new ad transparency source (Meta / Google / TikTok / …) with **a single declarative adapter**. A shared collection harness owns the CDP lifecycle, image capture, dedup, output schema, block STOP, and tab cleanup; the adapter provides **only that platform's specific flow and image matching**.
>
> Implementation: `${CLAUDE_PLUGIN_ROOT}/shared/collect/ad-collect-harness.mjs` (harness) + `${CLAUDE_PLUGIN_ROOT}/shared/collect/<source>-collect.mjs` (adapter). Live proof: both Meta (single-hop) and Google (multi-hop) run on one harness.

## Why this structure
- "Keyword strategy = shared across platforms, **entry/extraction = per-platform**." Shared: `ad-search-queries.mjs` (keyword model → queries), `lib.mjs`, output schema (= ad analysis input). Platform differences are isolated in the adapter.
- ⚠️ The early roadmap phrasing "just add an adapter (buildUrl/imgMatch)" was **inaccurate** (corrected by measurement). Meta is single-hop (one URL), but Google is **multi-hop + search-box interaction** (type → hover-click a suggestion → advertiser page), so the harness `ctx` must provide **typing/click primitives** beyond URL navigation. The contract accommodates both single-hop and multi-hop.

## Adapter interface
```
interface AdSourceAdapter {
  source: string;          // "meta_ad_library" | "google_ads_transparency" | …  (source in the output ad-creative.json)
  region: string;          // "KR"
  acceptModes: string[];   // query modes this source consumes: Meta=["keyword","advertiser"], Google=["advertiser"]
  imgMatch(url): boolean;  // identify an ad-creative image response URL (buffered from Network.responseReceived)
  async collect(ctx): void;// platform-specific flow. Fills creatives using ctx primitives.
}
```
- The collector filters queries with `filterQueriesByModes(queries, adapter.acceptModes)`, then calls `runCollection({adapter, queries, personaId, runId, port})`.

## ctx primitives (injected by the harness into collect)
| Primitive | Behavior |
|---|---|
| `queries` | the (already mode-filtered) query list `{mode,query}[]` |
| `goto(url) -> bool` | navigate + wait for load (loadEventFired/7s race) + **block STOP** (`false` when blocked) |
| `scroll(steps)` | real wheel scroll loop (induce lazy loading) |
| `evalJs(expr)` | in-page `Runtime.evaluate` (returnByValue) |
| `type(text)` | **real keyboard input** into the focused/first `<input>` (`Input.insertText` — Korean/Unicode-safe, not DOM value injection) |
| `suggestions(sel) -> [{text,x,y}]` | poll elements matching `sel` and return a list of innerText + viewport-center coordinates (the adapter picks by name-matching; no blind click on the first item) |
| `clickAt(x,y)` | **a real click including hover** at the coordinate (`mouseMoved→mousePressed→mouseReleased`; Angular Material overlays require hover), then wait for navigation |
| `resetBuffer()` | empty the image-response buffer (call before each entry) |
| `drain(meta)` | retrieve buffered `imgMatch` responses via `Network.getResponseBody` → save `images/ad-N.jpg` + push creatives (merge `meta`) |
| `flag(msg)` | add a coverage flag |
| `limitReached() -> bool` | totalCap (default 24) reached, or blocked |

## Single-hop vs multi-hop (collect examples)
**Meta (single-hop)** — one public filter URL per query:
```js
async collect(ctx){
  for (const {query:q} of ctx.queries){
    if (ctx.limitReached()) break;
    ctx.resetBuffer();
    if (!await ctx.goto(META.buildUrl(q))){ ctx.flag(`blocked: ${q}`); break; }
    await ctx.scroll(5);
    await ctx.drain();                         // subtype:"single_image" default
  }
}
```
**Google (multi-hop + interaction)** — advertiser-resolve-or-skip:
```js
async collect(ctx){
  for (const {query:name} of ctx.queries){     // acceptModes=["advertiser"] → advertiser names only
    if (ctx.limitReached()) break;
    ctx.resetBuffer();
    if (!await ctx.goto(GOOGLE.homeUrl)){ ctx.flag(`blocked: ${name}`); break; }
    await ctx.type(name);                       // real typing into the search box
    const sugg = await ctx.suggestions("material-select-item[role=option]");
    const picked = chooseAdvertiser(sugg, name); // exact>prefix>loose; prevent substring mis-resolution (토스≠파낙토스)
    if (!picked){ ctx.flag(`no_advertiser_match: ${name}`); continue; }  // Google has no topic-search creative page
    await ctx.clickAt(sugg[picked.index].x, sugg[picked.index].y);
    const advId = parseAdvertiserId(await ctx.evalJs("location.href"));
    if (advId){
      await ctx.scroll(4);
      const resolved = picked.quality === "loose" ? "advertiser_loose" : "advertiser";
      await ctx.drain({ advertiser_id: advId, resolved_via: resolved, matched_name: picked.name, match_quality: picked.quality });
      ctx.flag(`"${name}" → ${picked.name} (${picked.quality}) ${advId}`);
    } else ctx.flag(`no_nav_after_click: ${name}`);
  }
}
```

## Output schema (= ad analysis input, validated by `${CLAUDE_PLUGIN_ROOT}/schemas/collection/ad-creative.schema.json`)
`.generate-ads-img/runs/<runId>/ad-creatives/<personaId>/`:
- `ad-creative.json`: `{ persona_id, source, search{mode,query,category,country}, queries?, creatives[], coverage_flags[], blocked, captured_at }`
- `images/ad-N.jpg`
- creative: `{ image_url, image_file, subtype:"single_image", ...meta }`. Google adds `advertiser_id`, `resolved_via:"advertiser"|"advertiser_loose"`, `matched_name`, `match_quality`. The image refiner (seller's own / user-provided detail cuts (상세컷), not a collected source) adds `type`, `confidence`. ad analysis ocr-extractor consumes only `image_file`.
- **Schema enums** (validation gate): collected ad-library `source ∈ {meta_ad_library, google_ads_transparency, tiktok_creative_center}` with `search.mode ∈ {advertiser, keyword}`. (The schema also carries a refiner provenance label for the seller's own / user-provided detail cuts (상세컷) — an analysis input, not a collected source.) When adding a new source/mode or creative provenance field, **also extend `${CLAUDE_PLUGIN_ROOT}/schemas/collection/ad-creative.schema.json` (`additionalProperties:false`)** and confirm `validate-ad-creative.ts` PASS (if the schema is not extended, the output FAILs at the validation gate → the drop-in breaks).

## Procedure for adding a new source (TikTok, etc.)
1. **Live probe** (dedicated headless): directly observe the entry model (URL parameters vs. search interaction), image host, extraction path (DOM vs RPC vs getResponseBody), and block wording, and finalize them in `${CLAUDE_PLUGIN_ROOT}/shared/collect/<source>-probe-notes.md`. **No hardcoding from memory/third-party docs.**
2. **Write the adapter**: `source/region/acceptModes/imgMatch/collect(ctx)`. Build the flow with ctx primitives (single-hop → goto+drain; multi-hop → use type+suggestions+chooseAdvertiser+clickAt).
3. **Collector**: query source (`buildAdQueries` or confirmed competitors) → `filterQueriesByModes` → `runCollection`.
4. **Live standalone verification**: collect real creatives with one confirmed item → run through ad analysis. STOP on block (no workaround).

## Invariant rules (settled)
- Non-intrusive: dedicated headless (separate user-data-dir), **zero** `bringToFront`/`activateTarget`. Tabs are closed in `finally` + `CDP.Close` + a hard timeout (prevent orphan tabs).
- A public ad transparency tool's **filter URL is allowed** (that tool's API); assembling result deep-links, DOM value injection, and synthetic submit are forbidden. The starting point is search/click.
- STOP on a block response, no hackier workaround. **One exception (public, no-auth sources only)**: bot blocks caused solely by the headless `HeadlessChrome` UA token (e.g., TikTok 403) may be normalized to a standard Chrome UA via `Network.setUserAgentOverride`. CAPTCHA/stealth/session-forgery/behavioral-analysis bypass remains forbidden; on a stronger block, STOP. (Canonical: `~/.claude/rules/cdp-non-intrusive.md`)
- Topic keywords only on sources whose search model supports free topic search (Meta). Advertiser-centric sources (Google) get advertiser mode only.
```
Supply differs per platform — record no_advertiser_match / no creatives honestly in coverage_flags (no false completion).
```
