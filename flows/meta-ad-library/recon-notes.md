# Meta Ad Library — detail-modal + video recon notes

Live CDP recon (Task 1 spike). Source of truth for the selectors / patterns the later coding
tasks will hardcode. **All values below were observed live**, not guessed.

- **Run env**: dedicated headless Chrome (`launchChrome`, `--user-data-dir=/tmp/gai-meta-recon`),
  attached via `connect(port)` on an `acquirePort("meta-detail-recon")` port (9223 in this run).
  Non-intrusive: background, never `bringToFront`/`activateTarget`.
- **Front door used** (no `media_type` → includes video):
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&search_type=keyword_unordered&q=<kw>`
- **Query**: `q=비타민` (Korean keyword, country=KR). ~5,700 results. **Not blocked.**
- **Locale note**: the headless throwaway profile renders the UI in **English** ("See ad details",
  "Library ID", "Started running on", "Platforms", "Active", "Sponsored", "Close"), even with
  `country=KR`. Korean equivalents may appear with a `ko` profile, so selectors/parsers must accept
  **both** label variants. Korean variants (best-known): `상세정보`, `라이브러리 ID`, `집행 시작`/`게재 시작`,
  `플랫폼`, `활성`, `후원`, `닫기`. The English labels are the ones actually verified this run.

---

## 1. Per-ad "See ad details / 상세정보" trigger

- It is a **`div[role="button"]`** whose **`innerText` is exactly** `See ad details` (or `상세정보`).
  (A sibling `See summary details` button also exists — do NOT match it.)
- **Recommended locator** (text-based, class-agnostic — Meta classes are obfuscated & rotate):
  ```js
  [...document.querySelectorAll('div[role="button"]')]
    .filter(e => /^(See ad details|상세정보)$/.test((e.innerText||'').trim()))
  ```
- Observed class string (DO NOT rely on it — atomic CSS, will rotate):
  `x1i10hfl xjqpnuy xc5r6h4 xqeqjp1 x1phubyo x972fbf …`
- **Opening gotcha (load-bearing for the coding task):** a CDP `Input.dispatchMouseEvent` at the
  element's `getBoundingClientRect` center **did NOT open the modal** in headless — the page reflows
  during lazy-scroll so the cached coords miss, and the click landed on empty space. What reliably
  opened the modal was scrolling the element into center then clicking. Two safe options for the flow:
  (a) `el.scrollIntoView({block:'center'})` → re-read coords **immediately before** the CDP click
  (don't reuse coords read earlier), or (b) accept an in-page `el.click()` for the *expand* action
  (it is a real user-gesture-equivalent element activation, not DOM-value injection / synthetic
  submit). Recon used `el.click()` to map the modal; the flow should prefer (a) re-read-coords +
  CDP real-click to stay consistent with the project's real-interaction rule.

## 2. Inside the opened modal (`div[role="dialog"]`)

The modal is a **`div[role="dialog"]`**. Multiple `role="dialog"` nodes exist on the page (one is the
nav panel). Pick the one whose text contains `Library ID` / `라이브러리`:
```js
[...document.querySelectorAll('[role="dialog"]')]
  .map(d => ({ d, t: d.innerText || '' }))
  .filter(o => /Library ID|라이브러리/i.test(o.t))
  .sort((a,b) => b.t.length - a.t.length)[0]?.d
```

Fields are NOT in dedicated attributed nodes — they live as **flat lines in the dialog `innerText`**.
The robust extraction is to read `dialog.innerText` and parse by inline label. Raw text observed
(one ad, verbatim, `\n`-separated):
```
Ad details
Close
Active
Library ID: 1972922693648310
Started running on 26 Feb 2026
Platforms
진시황의 비밀
Sponsored
Library ID: 1972922693648310
Open Drop-down
0:00 / 0:43
RE4DAY.CO.KR
진시황의 비밀
Order now
About the advertiser
About ads and data use
Close
```

Per-field extraction (verified to yield the sample objects in §6):

| Field | How to extract from `dialog.innerText` | Raw observed |
|---|---|---|
| **library_id** | regex `Library ID:\s*([0-9]+)` | `Library ID: 1972922693648310` |
| **started_at** | regex `Started running on\s*(.+)` (KR: `집행 시작\|게재 시작`) | `Started running on 26 Feb 2026` |
| **status** | line matching `^(Active\|Inactive\|활성\|비활성)$` | `Active` |
| **advertiser** | the line **immediately before** the `Sponsored`/`후원` line | `진시황의 비밀` (line before `Sponsored`) |
| **platforms** | **NOT TEXT — see §7. Not reliably extractable in headless.** | (icons only) |
| **follower count** | **ABSENT from this modal — see §7.** | (not present) |
| video_duration (bonus: video-ad signal) | regex `\d+:\d{2}\s*/\s*\d+:\d{2}` present ⇒ video ad | `0:00 / 0:43` |

Notes:
- `Library ID` appears **twice** in the modal (header + under the advertiser block) — anchor on the
  first match.
- `advertiser` = the Page/advertiser display name (`진시황의 비밀`, `올록담`). The line below the video
  (`RE4DAY.CO.KR`) is the *link/landing domain*, not the advertiser name.

## 3. Modal close

- **ESC works** — verified: dispatching an `Escape` key event closed the dialog (`esc_closes: true`).
  Recommended: `Input.dispatchKeyEvent` Escape (rawKeyDown + keyUp).
- The modal also renders a `Close` control (text `Close` appears at top and bottom of the dialog);
  an `[aria-label*="Close"]` query inside the dialog returned no hits this run, so **prefer ESC** for
  the coding task (don't depend on an aria-labelled close button).

## 4. VIDEO ad network-response URL pattern

Video responses observed while scrolling (15+ per page, all `mimeType: "video/mp4"`, HTTP `206`):
```
https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m412/AQPa5lXt….mp4?_nc_cat=111&_nc_sid=ef5aa3&_nc_ht=video-icn2-1.xx.fbcdn.net
https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m69/AQOzSZmg….mp4?strext=1&…
```
- **Host**: `video-<region>.xx.fbcdn.net` (note the `video-` host prefix; image creatives are on
  `scontent-*.xx.fbcdn.net`).
- **Path**: `/o1/v/t2/…` and the URL ends in **`.mp4`** (before the `?` query).
- **`mimeType`** on the response is `video/mp4`.
- **Recommended `videoMatch(url)` predicate** (mime-led when available; URL fallback):
  ```js
  // in Network.responseReceived: prefer p.response.mimeType
  const videoMatch = (url, mime='') =>
    /^video\//i.test(mime) ||
    (/\.mp4(\?|$)/i.test(url) && /video-[a-z0-9-]+\.fbcdn\.net/i.test(url));
  ```
  (Don't reuse the image `imgMatch` — images are `t39.35426` + `scontent`; videos are a different
  host + `.mp4`.)

## 5. `Network.getResponseBody` on a video — DOES NOT RETURN BYTES

- Tested `getResponseBody` on 3 distinct `video/mp4` responses → **all failed** with
  `No data found for resource with given identifier`.
- Cause: video responses are HTTP **`206` partial-content / range requests**; Chrome does not retain
  the body in a getResponseBody-recoverable form (same eviction class the harness already swallows for
  images via the `/evict|No resource|No data found/` catch).
- **Decision for the schema**: **save `video_url` only, NOT a `video_file`.** Do not attempt to write
  video bytes from `getResponseBody`. (Images stay as-is: image bytes via `getResponseBody` DO work —
  re-verified a `t39.35426` jpg returned 47,470 bytes.)

## 6. RAW fixture samples (for normalization tests)

Two live samples, literal strings as scraped (shape
`{ status, library_id, started_at, advertiser, follower_raw, video_duration }`):
```json
[
  {
    "status": "Active",
    "library_id": "1972922693648310",
    "started_at": "26 Feb 2026",
    "advertiser": "진시황의 비밀",
    "follower_raw": null,
    "video_duration": "0:00 / 0:43"
  },
  {
    "status": "Active",
    "library_id": "1912634476109702",
    "started_at": "10 Jun 2026",
    "advertiser": "올록담",
    "follower_raw": null,
    "video_duration": "0:00 / 0:43"
  }
]
```
For the brief's requested shape `{ started_at, platforms:[...], advertiser, follower_raw, library_id }`:
`platforms` is `[]` (not extractable, §7) and `follower_raw` is `null` (absent, §7). `started_at` is a
**localized human date string** (`"26 Feb 2026"`) — normalization must parse this, not an ISO string.

## 7. Fields NOT reliably extractable in headless/background (user's worry, assessed)

**DOM reads DO work in background headless** — the detail-modal text fields (library_id, started_at,
status, advertiser, video_duration) were all read directly via `Runtime.evaluate` on
`dialog.innerText`. **No network capture is required** for these. The original image-capture had to go
through the network tab because *image bytes* can't be pulled from a non-painting background tab; but
*text DOM reads* don't need painting and work fine. So: **detail fields = DOM read; image bytes =
network getResponseBody; video bytes = neither (URL only).**

> **⚠️ §7 SUPERSEDED by §8 (follow-up recon).** The two bullets below were the FIRST-PASS
> conclusion and are **partly WRONG** — `follower_raw` IS extractable in-modal (expand the
> 광고주 정보 accordion), and `platforms` ARE extractable as a deterministic mask-position count.
> See §8 for the corrected, verified findings. Kept here for the record.

Two fields were thought NOT extractable (CORRECTED in §8):

- ~~**`platforms`**~~ — rendered under the `Platforms` label as CSS `mask-image` sprite icons
  (`mask: url(https://static.xx.fbcdn.net/rsrc.php/yx/r/l5lyqjmrz5p.webp)`), no
  `aria-label`/`alt`/`title`/text. **CORRECTED (§8):** each icon's **`mask-position` Y-offset is a
  deterministic per-platform key** — the platform COUNT and identity-keys ARE extractable; only the
  human name needs a maintained offset→name table.
- ~~**`follower_raw`**~~ — absent from the *collapsed* modal. **CORRECTED (§8):** the modal has a
  collapsed **광고주 정보 / About the advertiser** accordion; expanding it (real CDP click) reveals
  `팔로워 N명` (follower count) + page category + page ID **in-modal — no separate navigation.**

---

## 8. FOLLOW-UP RECON (corrects §2/§6/§7) — accordion expand, KR locale, platform re-map

Re-run in **KR locale** (Accept-Language `ko-KR` via `Network.setExtraHTTPHeaders` +
`setUserAgentOverride{acceptLanguage}` — a language pref, NOT stealth). The user's real modal is
Korean, so KR is the primary target; English appears with an EN profile. Both must be handled.

### 8a. KR ⊥ EN labels (both verified / best-known)

| Field | EN (run 1) | KR (run 2, verified) |
|---|---|---|
| detail trigger button text | `See ad details` | **`광고 상세 정보 보기`** (summary variant: `요약 세부 사항 보기`) |
| modal title | `Ad details` | `광고 상세 정보` |
| status | `Active` | `활성` (inactive: `비활성`) |
| library id label | `Library ID:` | `라이브러리 ID:` |
| started date | `Started running on 26 Feb 2026` | **`2026. 2. 26.에 게재 시작함`** |
| platforms label | `Platforms` | `플랫폼` |
| advertiser-info accordion | `About the advertiser` | **`광고주 정보`** |
| advertiser-vs-domain marker | `Sponsored` | `광고` |
| close | `Close` | `닫기` |

**Two date formats to parse** (both seen): EN `"26 Feb 2026"` (`D Mon YYYY`) and
KR `"2026. 2. 26.에 게재 시작함"` (`YYYY. M. D.에 게재 시작함` — extract the `YYYY. M. D.`). The detail
trigger locator must accept BOTH labels:
```js
[...document.querySelectorAll('div[role="button"]')]
  .filter(e => /^(See ad details|광고 상세 정보 보기|상세정보)$/.test((e.innerText||'').trim()))
```

### 8b. 광고주 정보 / About the advertiser accordion — FOLLOWER COUNT **IS** in-modal

The modal contains a **collapsed accordion** whose header text is `광고주 정보` (`About the advertiser`).
Expanding it reveals advertiser detail **inside the same dialog — no navigation**.

- **Expand trigger**: the leaf element whose exact text is `광고주 정보` / `About the advertiser`.
  Locator:
  ```js
  [...dialog.querySelectorAll('*')].filter(e => {
    const t=(e.textContent||'').trim();
    return /^(광고주 정보|About the advertiser|Advertiser info)$/i.test(t)
        && ![...e.children].some(ch=>/광고주 정보|About the advertiser/i.test(ch.textContent||''));
  })[0]
  ```
- **GOTCHA (load-bearing):** an in-page `el.click()` on the header (or its wrapper) **does NOT toggle**
  the accordion. A **real CDP `Input.dispatchMouseEvent` at the header's fresh center coords DID** open
  it (dialog innerText grew 188→261 chars). So the coding task must `scrollIntoView` the header, re-read
  its `getBoundingClientRect` center, then CDP-click — not `el.click()`.
- **Revealed content (verbatim, ad `진시황의 비밀`):**
  ```
  광고주 정보
  진시황의 비밀          ← page/advertiser name
  ID: 275345032325614   ← page ID (≠ library_id)
  팔로워 35명 •          ← FOLLOWER COUNT
  건강/뷰티              ← page category
  추가 정보
  진시황의 건강 비밀.. 나는 알고 있지   ← page bio
  ```
- **follower extraction**: regex on dialog innerText `팔로워\s*([0-9][0-9.,]*\s*(?:천|만|억)?\s*명?)`
  → raw `"팔로워 35명"` / `"팔로워 192명"`. EN variant: `([0-9][0-9.,]*[KMB]?)\s*followers`.
  Normalizer must handle KR magnitude suffixes (`천`=×1e3, `만`=×1e4, `억`=×1e8) and the `명` counter,
  alongside EN `K/M/B`. Note: small advertisers show plain counts (35, 192) — no suffix.
- page **category** (`건강/뷰티`) and page **ID** are also revealed — available if wanted.

### 8c. Platforms — extractable as deterministic mask-position offsets (count is solid; name needs a table)

Icons under `플랫폼` are a single sprite (`l5lyqjmrz5p.webp`) with **no aria-label/title/alt**, BUT each
icon has a distinct **`mask-position`** — a deterministic per-platform key. Two live ads:

| Ad | platform count | mask-position Y-offsets (in render order) |
|---|---|---|
| `진시황의 비밀` | 2 | `-766px`, `-805px` |
| `올록담` | 4 | `-766px`, `-805px`, `-818px`, `-831px` |

(all share `x = -387px`; only Y varies.) The **count and identity-keys are reliable**. The
offset→name mapping (derived from render order + the user's screenshot of a 4-platform ad showing
Facebook / Instagram / Messenger / Threads, ascending) is **🟡 best-inference, NOT DOM-confirmed**:

| Y-offset | inferred platform |
|---|---|
| `-766px` | Facebook |
| `-805px` | Instagram |
| `-818px` | Messenger |
| `-831px` | Threads / Audience Network |

**Recommended extraction for the coding task**: read each platform icon's computed `mask-position`
(via `getComputedStyle`), collect the Y-offsets in order, and resolve names through a **small maintained
lookup table** seeded with the values above. The table is the only brittle part (sprite offsets shift
if Meta re-bakes the sheet) — so store the raw offset too and treat unknown offsets as
`platform:"unknown(<offset>)"` rather than dropping. **Platforms are NO LONGER recommended for
omission** — extract them; just keep the offset→name table maintainable.

### 8d. Corrected fixture samples (KR locale, accordion expanded)

```json
[
  { "status":"활성", "library_id":"1972922693648310",
    "started_at":"2026. 2. 26.에 게재 시작함", "advertiser":"진시황의 비밀",
    "follower_raw":"팔로워 35명", "category":"건강/뷰티", "page_id":"275345032325614",
    "platform_offsets":["-387px -766px","-387px -805px"], "video_duration":"0:00 / 0:43" },
  { "status":"활성", "library_id":"1912634476109702",
    "started_at":"...에 게재 시작함", "advertiser":"올록담",
    "follower_raw":"팔로워 192명", "category":"건강/뷰티",
    "platform_offsets":["-387px -766px","-387px -805px","-387px -818px","-387px -831px"],
    "video_duration":"0:00 / 0:43" }
]
```
(EN-locale equivalents from §6 remain valid: `started_at:"26 Feb 2026"`, `status:"Active"`.)

---

### How recon was run
Throwaway scripts `flows/meta-ad-library/_recon.mjs` (run-1, EN) and
`flows/meta-ad-library/_recon_followup.mjs` (run-2, KR locale: accordion expand + platform re-map),
kept as documentation of method. Method iterated through DOM-diff to locate the real `role=dialog`,
full-text dump, structured-field extraction, then KR-locale accordion expansion + sprite-offset
mapping. Each CDP step is timeout-bounded (`Promise.race` + `sleep`) per the headless-hang gotcha;
scrolling is in-page `window.scrollBy` (never `Input.mouseWheel`, which never acks in headless). The
accordion required a **real CDP click** (not `el.click()`) to toggle.

---

## 9. TASK 6 LIVE BUILD findings (corrects §1/§2/§4; settles image↔detail association)

Built + verified live (`q=비타민`, KR, dedicated headless via acquire-port→launch-chrome). Not blocked.
24 creatives, 6 detail_captured, **6/6** with started_at(ISO)·advertiser_name·follower_count(number)·
platforms·page_category, 5/6 page_id. Schema validator: PASS.

### 9a. IMAGE↔DETAIL ASSOCIATION — decision: deterministic image-URL key join (NOT Approach A, NOT order)
- **Approach A (per-card resetBuffer→drain) is DEAD.** Opening a detail modal triggers **NO fresh creative
  network response** (buffer grew **0** on every card — measured). Creatives load **once** during grid scroll
  then are **cached**; scrolling a card back into view does **not** re-fetch (also measured: `buf=0`). So a
  per-card resetBuffer would discard everything.
- **Chosen: deterministic key-join.** Each grid card's `<img>.currentSrc` (query-stripped) **EXACTLY equals**
  a buffered network creative URL (query-stripped) — verified for cards 0–5 (matched 100%). The flow builds
  `metaByKey = { [dedupKey(cardImgSrc)]: normalizedDetail }` and the harness `drain(meta, metaByKey)` merges
  each card's detail into the creative whose `image_url` matches the key. **No network-order assumption, no
  mis-join.** (Harness `drain` gained an optional second `metaByKey` arg — backward compatible.)

### 9b. Modal OPEN — `el.click()` works; CDP-click does NOT (reverses §1's preference)
- A CDP `Input.dispatchMouseEvent` at the trigger's fresh re-read center **did not open** the modal in headless
  (`dlgLen=0`), even with coords re-read immediately before the click. **`el.click()` opens it reliably**
  (`libid` extracted). `el.click()` is a genuine element activation (allowed per §1(b)), not DOM-value
  injection / synthetic submit. The flow opens modals with `el.click()`.

### 9c. DLG selector tightened — `라이브러리 ID`, not bare `라이브러리`
- §2's `/Library ID|라이브러리/` **false-matched the nav panel** (it contains the bare words "광고 라이브러리"),
  so the flow read the nav menu instead of the ad modal (`libid=null`). Anchor on the **labelled id**
  `/Library ID|라이브러리 ID/` to exclude the nav panel.

### 9d. Accordion expand — `block:'start'` is load-bearing; CDP-click still required
- §8b confirmed: `el.click()` does NOT toggle the 광고주 정보 accordion; a real CDP click does. **New live
  finding:** `scrollIntoView({block:'center'})` puts the header near viewport-center (large y) where the CDP
  click **silently no-ops** (hit-tests to the right element but doesn't toggle — a headless lower-viewport
  click quirk); `block:'start'` lands it near the top (y≈150) where it **reliably toggles**. The flow
  retries once and gates on a HAS_FOLLOWER verify.

### 9e. Modal CLOSE — must click the top Close control + VERIFY (ESC alone stacks modals)
- **The dominant bug.** ESC closes the **first 1–2** modals but then **stops closing** them; unclosed modals
  **accumulate** (`role=dialog` count grew 2→3→4→5→6 across cards) and the DLG "longest match" then picks a
  **stale, tall** dialog whose accordion is ~2100px off-screen → all later follower/page_id extraction failed.
  Fix: close via the modal's **top-right "Close"/"닫기" control** (CDP click) and **verify the dialog is gone**
  before the next card (ESC retained as fallback). This single fix took follower coverage 1/6 → **6/6**.

### 9f. Follower label — EN is singular "1 follower" (not only "N followers")
- The scraping regex must use `followers?` (optional s); EN small pages render `1 follower`. (The normalizer
  already handled it; the in-page scrape regex did not.)

### 9g. videoMatch URL fallback — the brief's host regex was wrong
- recon §4's own video URLs are `video-icn2-1.xx.fbcdn.net` (region label + `.xx` **infix**). The brief's
  `video-[a-z0-9-]+\.fbcdn\.net` does **not** match them (no `.`). Corrected to `video-[a-z0-9.-]+\.fbcdn\.net`.
  The **mime path (`video/mp4`) is the primary signal** and unaffected.

### 9h. Video creatives — appear as ads but `.mp4` does not load in background headless
- Several captured ads ARE video ads (`video_duration:"0:00 / 0:43"`), but **no `.mp4` network response fired**
  (no autoplay in a background/non-painting headless tab), so videoMatch had nothing to buffer → **0
  `subtype:"video"` records this run**; the video ads are captured as their **image thumbnails** (subtype
  single_image) with the `video_duration` field preserved. The video path (matcher + url-only drain fallback)
  is wired and unit-verified; it will populate when a `.mp4` response is present. Honest headless limitation,
  not a flow defect.

### 9i. Harness changes made to support the above (generic, backward-compatible)
- `ctx.sleep(ms)` (bounded settle wait), `ctx.esc()` (real ESC), and `drain(meta, metaByKey)` per-key merge.
- `Emulation.setDeviceMetricsOverride(1280×1696)` + `--window-size=1280,1696` (a 469px default headless
  viewport hides modal controls below the fold) + ko-KR `Accept-Language`/UA acceptLanguage (a language pref
  per the UA-normalization carve-out, NOT stealth) so the collected labels match the user's KR modal.
