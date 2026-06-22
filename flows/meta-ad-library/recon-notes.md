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

Two fields are genuinely NOT extractable here and should be **dropped from the schema** (or marked
optional/null) with this rationale:

- **`platforms` (FB/IG/Messenger/Audience Network)** — rendered under the `Platforms` label as CSS
  **`mask-image` sprite icons** (`mask: url(https://static.xx.fbcdn.net/rsrc.php/yx/r/l5lyqjmrz5p.webp)`),
  **no `aria-label` / `alt` / `title` / text**. Identifying which platform each icon is would require
  sprite-offset / pixel analysis — out of scope and brittle. **Recommend: omit `platforms` from the
  normalized schema** (or store `platforms: []` with a note). Not a headless limitation per se — the
  data simply isn't in any text/attribute node.
- **`follower_raw` (follower count)** — **not present in the Ad details modal at all** (`followers`/
  `팔로워` word absent). It may live behind the modal's `About the advertiser` link (a further click /
  navigation), which is out of scope for this spike. **Recommend: omit `follower_raw`** unless a later
  task explicitly drills into "About the advertiser".

---

### How recon was run
Throwaway scripts `flows/meta-ad-library/_recon*.mjs` (kept as documentation of method): pass 1 video
sniff + initial modal attempt; pass 3 DOM-diff that located the real `role=dialog`; pass 4 full modal
text; pass 5 structured-field extraction + 2 fixture samples + platform-sprite/follower probing.
Each CDP step is timeout-bounded (`Promise.race` + `sleep`) per the headless-hang gotcha; scrolling is
in-page `window.scrollBy` (never `Input.mouseWheel`, which never acks in headless).
