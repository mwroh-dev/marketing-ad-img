# Meta Ad Library 상세정보 모달 + 비디오 수집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메타 광고 라이브러리에서 각 광고의 "상세정보" 모달(개시일·게재 플랫폼·광고주명·팔로워)과 비디오 광고까지 수집해 `ad-creative.json` 아티팩트에 쌓는다.

**Architecture:** 새 에이전트 없이 collection 계층(스키마 + 메타 flow + harness + runbook)을 확장한다. 결정론적이고 테스트 가능한 로직(필드 정규화·레코드 생성·응답 분류)은 순수 함수로 분리해 단위 테스트하고, CDP 배선(모달 클릭·셀렉터·비디오 매처)은 라이브 recon으로 확정·검증한다.

**Tech Stack:** Node ESM (`.mjs`), `node:test` + `node:assert/strict` (러너: `node --test shared`), AJV 스키마 검증 (`tsx` validators), chrome-remote-interface (CDP).

## Global Constraints

- 새 에이전트/스킬 신설 금지 — flow/harness/schema/runbook만 수정 (커밋 a59399f: `no dedicated collector subagent by design`).
- CDP 비침습: 백그라운드 탭, `bringToFront`/`activateTarget` 호출 0건. 포트는 `shared/collect/acquire-port.mjs`로 확보. 기본 헤드리스 포트 9291.
- STOP-on-block: 차단/모달 미오픈 시 더 우회하지 말고 멈추고 `detail_captured:false`로 기록(에러 은닉 금지).
- no-URL-assembly: 네비게이션은 `ad-collect-harness.goto`의 `matchToolEntry` 화이트리스트만. 모달은 in-page 클릭(네비게이션 아님)으로 연다.
- 테스트 러너: 모든 `*.test.mjs`는 `shared/` 트리 아래에 있어야 `node --test shared`가 수집한다. flow 디렉토리 테스트는 별도 실행(아래 각 태스크에 명시).
- 1차 범위 = 상세정보 모달 + 비디오 + 스키마. 검색 각도(키워드/경쟁사 #3·#4)와 다운스트림 에이전트 보고는 비범위(별도 작업).

## 파일 구조 (생성/수정)

- 수정 `schemas/collection/ad-creative.schema.json` — 비디오·상세정보 필드 추가, creative `required` 완화.
- 생성 `flows/meta-ad-library/detail-normalize.mjs` — `parseFollowerCount`, `normalizeDetail` 순수 함수.
- 생성 `flows/meta-ad-library/detail-normalize.test.mjs` — 위 순수 함수 단위 테스트.
- 생성 `flows/meta-ad-library/recon-notes.md` — Task 1 라이브 recon 산출물(셀렉터/비디오 URL 패턴/비디오 바이트 가용성).
- 수정 `shared/collect/ad-source-helpers.mjs` — `buildCreativeRecord`, `classifyResponse` 순수 함수 추가.
- 수정 `shared/collect/ad-source-helpers.test.mjs` — 위 두 함수 단위 테스트 추가.
- 수정 `shared/collect/ad-collect-harness.mjs` — 비디오 버퍼 분류, drain이 `buildCreativeRecord` 사용 + `videos/` 저장.
- 수정 `flows/meta-ad-library/flow.mjs` — 모달 expand 루프 + `videoMatch` + `media_type:"image"` 제약 해제.
- 수정 `shared/validators/validate-ad-creative.ts` — image_url OR video_url 교차검증 + `detail_captured` 카운트.
- 수정 `knowledge/reference/modes/data-collection.md` — 모달 expand·비디오 절차 문서화.

---

### Task 1: 라이브 CDP recon (스파이크 — 셀렉터/비디오 패턴 확정)

이 태스크는 TDD가 아니라 발견(discovery) 스파이크다. 산출물(recon 노트 + 정규화 테스트용 raw 샘플)이 이후 모든 태스크의 입력이다.

**Files:**
- Create: `flows/meta-ad-library/recon-notes.md`

**Produces (이후 태스크가 의존):**
- "상세정보" 모달을 여는 트리거 요소 셀렉터.
- 모달 안에서 개시일·게재 플랫폼·광고주명·팔로워·library_id를 잡는 셀렉터.
- 비디오 광고 응답의 네트워크 URL 매치 패턴(예: `video.xx.fbcdn.net` / `.mp4`) → `videoMatch` 근거.
- `Network.getResponseBody`로 비디오 바이트가 실제로 받아지는지 여부(받아지면 `video_file` 저장, 안 되면 `video_url`만).
- 정규화 테스트 fixture가 될 raw 객체 샘플 1~2건(개시일/플랫폼/광고주/팔로워 원문 문자열).

- [ ] **Step 1: 포트 확보 + 백그라운드 탭에서 메타 광고 라이브러리 열기**

Run:
```bash
node shared/collect/acquire-port.mjs   # 헤드리스 Chrome 포트 확보 (출력 포트 번호 기록)
```
그 포트로 백그라운드 탭에서 `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q=<임의 키워드>` 를 연다. `bringToFront`/`activateTarget` 호출하지 말 것. 비디오 포함을 보려면 `media_type` 파라미터를 넣지 않는다(전체).

- [ ] **Step 2: 모달 셀렉터 확보**

광고 카드의 "상세정보"(See ad details / 자세히 보기) 트리거를 `Runtime.evaluate`로 찾고, 클릭 후 뜨는 모달의 DOM을 떠서 개시일·게재 플랫폼·광고주명·팔로워·library_id 각 셀렉터를 식별한다. 셀렉터와 원문 텍스트 샘플을 `recon-notes.md`에 기록.

- [ ] **Step 3: 비디오 응답 패턴 + 바이트 가용성 확인**

`media_type` 제약 없이 스크롤하며 `Network.responseReceived`로 비디오로 보이는 응답 URL을 수집해 매치 패턴 후보를 적는다. 후보 1건에 `Network.getResponseBody`를 시도해 바이트가 받아지는지(또는 `No data found`/evict로 실패하는지) 기록한다.

- [ ] **Step 4: recon-notes.md 작성 + 커밋**

위 셀렉터/패턴/가용성/raw 샘플을 `recon-notes.md`에 정리. 차단되면 STOP하고 무엇이 차단됐는지 기록(우회 금지).

```bash
git add flows/meta-ad-library/recon-notes.md
git commit -m "recon: Meta detail-modal selectors + video URL pattern + byte availability"
```

> 이후 태스크의 셀렉터 문자열·비디오 매치 패턴은 이 노트의 값으로 채운다. recon에서 어떤 필드가 백그라운드 탭 DOM에서 안 잡히면 그 필드는 스키마/정규화에서 제외하고 그 사유를 `recon-notes.md`에 남긴다.

---

### Task 2: 스키마 확장 (비디오 + 상세정보 필드)

**Files:**
- Modify: `schemas/collection/ad-creative.schema.json:25-47` (creatives.items)
- Test: `flows/meta-ad-library/detail-normalize.test.mjs` (Task 3에서 생성; 본 태스크는 임시 검증 스크립트로 확인)

**Interfaces:**
- Produces: creative 레코드 형태 — 신규 옵션 필드 `video_url`(string), `video_file`(string), `follower_count`(integer|null), `detail_captured`(boolean), `advertiser_name`(string); `subtype` enum에 `"video"` 추가; creative `required`를 `["subtype"]`로 완화.

- [ ] **Step 1: 스키마 수정**

`schemas/collection/ad-creative.schema.json`의 creatives.items에서:
- `"required": ["image_url", "subtype"]` → `"required": ["subtype"]` 로 변경 (라인 30).
- `subtype` enum (라인 38)을 `["single_image", "carousel", "video_thumb", "video"]` 로 변경.
- properties에 다음 추가:
```json
"video_url": { "type": "string" },
"video_file": { "type": "string" },
"follower_count": { "type": ["integer", "null"], "minimum": 0 },
"detail_captured": { "type": "boolean" },
"advertiser_name": { "type": "string" }
```

- [ ] **Step 2: 확장 레코드가 검증을 통과하는지 임시 확인**

임시 픽스처로 검증:
```bash
cat > /tmp/ad-sample.json <<'JSON'
{ "persona_id":"p1","source":"meta_ad_library","search":{"mode":"keyword","query":"비타민"},
  "creatives":[
    {"image_url":"https://x/img","image_file":"images/ad-0.jpg","subtype":"single_image","started_at":"2026-05-01","platforms":["facebook","instagram"],"advertiser_name":"BrandX","follower_count":12000,"detail_captured":true},
    {"video_url":"https://x/vid","video_file":"videos/ad-1.mp4","subtype":"video","follower_count":null,"detail_captured":false}
  ] }
JSON
npx tsx shared/validators/validate-ad-creative.ts /tmp/ad-sample.json
```
Expected: 스키마 `report` PASS. (cross-check는 Task 7에서 video_url 허용으로 수정 — 그 전까지 image_url 없는 video 레코드에서 cross-check만 FAIL일 수 있으나 스키마 report는 PASS여야 함.)

- [ ] **Step 3: 커밋**

```bash
git add schemas/collection/ad-creative.schema.json
git commit -m "feat(schema): add video + detail-modal fields to ad-creative; relax creative required to [subtype]"
```

---

### Task 3: 상세정보 정규화 순수 함수 (`detail-normalize.mjs`)

**Files:**
- Create: `flows/meta-ad-library/detail-normalize.mjs`
- Create: `flows/meta-ad-library/detail-normalize.test.mjs`

**Interfaces:**
- Produces:
  - `parseFollowerCount(raw: string|null): number|null` — "1.2K"→1200, "3.4M"→3400000, "12,345"→12345, 빈/널/파싱불가→null.
  - `normalizeDetail(raw: {started_at?, platforms?, advertiser?, follower_raw?, library_id?}): {started_at?, platforms?, advertiser_name?, follower_count?, library_id?, detail_captured: boolean}` — 문자열 trim, platforms 배열 정리(빈 항목 제거·소문자), follower_count=parseFollowerCount(follower_raw), 의미있는 필드가 하나라도 있으면 `detail_captured:true`. 빈 입력이면 `{detail_captured:false}`.
- Consumes: Task 6의 flow가 in-page evalJs로 만든 raw 객체.

- [ ] **Step 1: 실패하는 테스트 작성**

`flows/meta-ad-library/detail-normalize.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseFollowerCount, normalizeDetail } from "./detail-normalize.mjs";

test("parseFollowerCount handles K/M, commas, junk", () => {
  assert.equal(parseFollowerCount("1.2K"), 1200);
  assert.equal(parseFollowerCount("3.4M"), 3400000);
  assert.equal(parseFollowerCount("12,345"), 12345);
  assert.equal(parseFollowerCount("987"), 987);
  assert.equal(parseFollowerCount(""), null);
  assert.equal(parseFollowerCount(null), null);
  assert.equal(parseFollowerCount("팔로워 없음"), null);
});

test("normalizeDetail trims, builds platforms, sets detail_captured", () => {
  const out = normalizeDetail({
    started_at: " 2026-05-01 ",
    platforms: ["Facebook", "", "Instagram"],
    advertiser: "  BrandX  ",
    follower_raw: "1.2K",
    library_id: "123456789",
  });
  assert.equal(out.started_at, "2026-05-01");
  assert.deepEqual(out.platforms, ["facebook", "instagram"]);
  assert.equal(out.advertiser_name, "BrandX");
  assert.equal(out.follower_count, 1200);
  assert.equal(out.library_id, "123456789");
  assert.equal(out.detail_captured, true);
});

test("normalizeDetail on empty input → detail_captured false", () => {
  assert.deepEqual(normalizeDetail({}), { detail_captured: false });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test flows/meta-ad-library/detail-normalize.test.mjs`
Expected: FAIL — `Cannot find module './detail-normalize.mjs'`.

- [ ] **Step 3: 최소 구현**

`flows/meta-ad-library/detail-normalize.mjs`:
```js
// Pure normalization of the Meta detail-modal raw fields scraped in-page.
// Selectors live in flow.mjs (live-confirmed via recon); this module is the testable cleanup layer.

export function parseFollowerCount(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/([\d.,]+)\s*([KMkm])?/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(num)) return null;
  const mult = m[2] ? { k: 1e3, m: 1e6 }[m[2].toLowerCase()] : 1;
  return Math.round(num * mult);
}

export function normalizeDetail(raw = {}) {
  const out = {};
  const started = (raw.started_at ?? "").toString().trim();
  if (started) out.started_at = started;
  const platforms = Array.isArray(raw.platforms)
    ? raw.platforms.map((p) => String(p || "").trim().toLowerCase()).filter(Boolean)
    : [];
  if (platforms.length) out.platforms = platforms;
  const adv = (raw.advertiser ?? "").toString().trim();
  if (adv) out.advertiser_name = adv;
  const fc = parseFollowerCount(raw.follower_raw);
  if (fc != null) out.follower_count = fc;
  const lib = (raw.library_id ?? "").toString().trim();
  if (lib) out.library_id = lib;
  out.detail_captured = Object.keys(out).length > 0;
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test flows/meta-ad-library/detail-normalize.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add flows/meta-ad-library/detail-normalize.mjs flows/meta-ad-library/detail-normalize.test.mjs
git commit -m "feat(meta): detail-modal field normalization (parseFollowerCount, normalizeDetail)"
```

---

### Task 4: 레코드 생성 + 응답 분류 순수 함수 (`ad-source-helpers.mjs`)

**Files:**
- Modify: `shared/collect/ad-source-helpers.mjs` (함수 추가)
- Modify: `shared/collect/ad-source-helpers.test.mjs` (테스트 추가)

**Interfaces:**
- Produces:
  - `classifyResponse(url: string, adapter: {imgMatch?, videoMatch?}): "image"|"video"|null` — videoMatch 우선, 그다음 imgMatch, 둘 다 아니면 null.
  - `buildCreativeRecord({ kind, key, n, meta, saved }): object` — kind "video"→`{video_url:key, subtype:"video", ...meta}` (+ saved면 `video_file:"videos/ad-${n}.mp4"`); 그 외→`{image_url:key, subtype:"single_image", ...meta}` (+ saved면 `image_file:"images/ad-${n}.jpg"`). `saved` 기본 true.
- Consumes: Task 5 harness가 호출.

- [ ] **Step 1: 실패하는 테스트 작성**

`shared/collect/ad-source-helpers.test.mjs` 끝에 추가 (파일 상단 import에 `buildCreativeRecord, classifyResponse` 추가):
```js
import { chooseAdvertiser, buildCreativeRecord, classifyResponse } from "./ad-source-helpers.mjs";

test("classifyResponse prefers video then image then null", () => {
  const a = { imgMatch: (u) => u.includes("img"), videoMatch: (u) => u.includes("vid") };
  assert.equal(classifyResponse("https://x/vid.mp4", a), "video");
  assert.equal(classifyResponse("https://x/img.jpg", a), "image");
  assert.equal(classifyResponse("https://x/other", a), null);
  assert.equal(classifyResponse("https://x/img", { imgMatch: (u) => u.includes("img") }), "image"); // no videoMatch
});

test("buildCreativeRecord shapes image and video records", () => {
  const img = buildCreativeRecord({ kind: "image", key: "https://x/i", n: 0, meta: { detail_captured: true } });
  assert.equal(img.subtype, "single_image");
  assert.equal(img.image_url, "https://x/i");
  assert.equal(img.image_file, "images/ad-0.jpg");
  assert.equal(img.detail_captured, true);

  const vid = buildCreativeRecord({ kind: "video", key: "https://x/v", n: 2, meta: {} });
  assert.equal(vid.subtype, "video");
  assert.equal(vid.video_url, "https://x/v");
  assert.equal(vid.video_file, "videos/ad-2.mp4");
  assert.equal(vid.image_url, undefined);

  const unsaved = buildCreativeRecord({ kind: "video", key: "https://x/v", n: 3, meta: {}, saved: false });
  assert.equal(unsaved.video_file, undefined);
  assert.equal(unsaved.video_url, "https://x/v");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test shared/collect/ad-source-helpers.test.mjs`
Expected: FAIL — `buildCreativeRecord is not a function` / `classifyResponse is not a function`.

- [ ] **Step 3: 최소 구현**

`shared/collect/ad-source-helpers.mjs` 끝에 추가:
```js
// Classify a network response URL for an adapter: video takes precedence over image.
export function classifyResponse(url, adapter) {
  if (adapter && typeof adapter.videoMatch === "function" && adapter.videoMatch(url)) return "video";
  if (adapter && typeof adapter.imgMatch === "function" && adapter.imgMatch(url)) return "image";
  return null;
}

// Build one creative record. `meta` carries detail-modal fields merged from normalizeDetail.
export function buildCreativeRecord({ kind, key, n, meta = {}, saved = true }) {
  if (kind === "video") {
    const rec = { video_url: key, subtype: "video", ...meta };
    if (saved) rec.video_file = `videos/ad-${n}.mp4`;
    return rec;
  }
  const rec = { image_url: key, subtype: "single_image", ...meta };
  if (saved) rec.image_file = `images/ad-${n}.jpg`;
  return rec;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test shared/collect/ad-source-helpers.test.mjs`
Expected: PASS (기존 + 신규 테스트).

- [ ] **Step 5: 커밋**

```bash
git add shared/collect/ad-source-helpers.mjs shared/collect/ad-source-helpers.test.mjs
git commit -m "feat(collect): classifyResponse + buildCreativeRecord (image/video record shaping)"
```

---

### Task 5: harness 비디오 버퍼 + drain 배선

**Files:**
- Modify: `shared/collect/ad-collect-harness.mjs:48-60` (버퍼 구조 + responseReceived), `:126-142` (drain)

**Interfaces:**
- Consumes: `classifyResponse`, `buildCreativeRecord` (Task 4), `safeName`/`dedupKey` (기존).
- Produces: `drain(meta)`가 버퍼된 응답을 kind별로 image→`images/ad-N.jpg` / video→`videos/ad-N.mp4`로 저장하고 `buildCreativeRecord`로 레코드 생성. 비디오 바이트 실패 시 `saved:false`로 video_url만 push + coverage flag.

- [ ] **Step 1: import + 버퍼 분류 수정**

`ad-collect-harness.mjs` 상단 import에 추가:
```js
import { dedupKey, safeName, classifyResponse, buildCreativeRecord } from "./ad-source-helpers.mjs";
```
(기존 `import { dedupKey, safeName } from "./ad-source-helpers.mjs";` 교체.)

`responseReceived` 핸들러(라인 57-60)를 kind 기록으로 교체:
```js
c.Network.responseReceived((p) => {
  const u = (p.response && p.response.url) || "";
  const kind = classifyResponse(u, adapter);
  if (kind) buf.set(u, { rid: p.requestId, kind });
});
```

- [ ] **Step 2: videos 디렉토리 + drain 수정**

`imgDir` 선언부(라인 41-42) 옆에 비디오 디렉토리 추가:
```js
const imgDir = `${outDir}/images`;
const vidDir = `${outDir}/videos`;
mkdirSync(imgDir, { recursive: true });
mkdirSync(vidDir, { recursive: true });
```

`drain`(라인 126-142)을 교체:
```js
drain: async (meta = {}) => {
  await sleep(1200);
  for (const [u, { rid, kind }] of buf) {
    const key = dedupKey(u);
    if (seen.has(key) || result.creatives.length >= totalCap) continue;
    try {
      const b = await c.Network.getResponseBody({ requestId: rid });
      const bytes = b.base64Encoded ? Buffer.from(b.body, "base64") : Buffer.from(b.body);
      if (bytes.length <= 2000) continue;
      seen.add(key);
      const n = result.creatives.length;
      if (kind === "video") {
        writeFileSync(`${vidDir}/ad-${n}.mp4`, bytes);
        result.creatives.push(buildCreativeRecord({ kind: "video", key, n, meta, saved: true }));
      } else {
        writeFileSync(`${imgDir}/ad-${n}.jpg`, bytes);
        result.creatives.push(buildCreativeRecord({ kind: "image", key, n, meta, saved: true }));
      }
    } catch (e) {
      // Video bytes often unavailable via getResponseBody (MSE/range). Keep the URL, skip the file.
      if (kind === "video" && /evict|No resource|No data found/i.test(e?.message ?? "")) {
        if (!seen.has(key) && result.creatives.length < totalCap) {
          seen.add(key);
          const n = result.creatives.length;
          result.creatives.push(buildCreativeRecord({ kind: "video", key, n, meta, saved: false }));
          result.coverage_flags.push("video bytes unavailable — url only");
        }
      } else if (!/evict|No resource|No data found/i.test(e?.message ?? "")) {
        console.error("drain skip:", key, e?.message);
      }
    }
  }
},
```

- [ ] **Step 3: 회귀 테스트 통과 확인**

Run: `node --test shared`
Expected: PASS (기존 `ad-collect-harness.test.mjs`의 makeResult 테스트 + 전체 shared 스위트 그린). harness의 CDP 경로는 라이브(Task 8)로 검증.

- [ ] **Step 4: 커밋**

```bash
git add shared/collect/ad-collect-harness.mjs
git commit -m "feat(harness): buffer video responses + drain saves videos/ via buildCreativeRecord (url-only fallback)"
```

---

### Task 6: 메타 flow — 모달 expand 루프 + 비디오 매처 + media_type 해제

**Files:**
- Modify: `flows/meta-ad-library/flow.mjs`

**Interfaces:**
- Consumes: `normalizeDetail` (Task 3), ctx 프리미티브 `evalJs`/`clickAt`/`scroll`/`drain` (harness).
- 셀렉터 문자열과 `videoMatch` 패턴은 **Task 1 recon-notes.md의 확정값으로 채운다** (아래는 구조; `<RECON:*>`는 recon 값으로 치환).

- [ ] **Step 1: videoMatch + media_type 해제**

`flows/meta-ad-library/flow.mjs`에서:
- 상단 import 추가: `import { normalizeDetail } from "./detail-normalize.mjs";`
- `imgMatch` 다음 줄에 `videoMatch` 추가 (recon 패턴으로):
```js
videoMatch: (u) => u.indexOf("<RECON:VIDEO_HOST_OR_EXT>") > -1,   // recon-notes.md에서 확정
```
- `config`에서 `media_type: "image"` 제거(또는 `media_type: "all"`로 — recon에서 비디오가 포함되는 값 확인). filterUrl이 config를 펼치므로 키 제거로 충분.

- [ ] **Step 2: 모달 expand 루프 추가**

`collect(ctx)`에서 `await ctx.scroll(...)` 다음, `await ctx.drain()` **전에** 광고별 상세정보 추출 루프를 삽입. drain은 마지막에 각 creative에 detail meta를 병합해야 하므로, detail은 광고 카드 순서대로 모은 뒤 drain에 마지막 카드의 meta가 아니라 카드별 meta가 필요 → 구조상 detail을 카드별로 모아 배열로 보관하고, drain 후 인덱스로 병합한다. 구현:

```js
async collect(ctx) {
  for (const { query: q } of ctx.queries) {
    if (ctx.limitReached()) break;
    ctx.resetBuffer();
    if (!(await ctx.goto(this.filterUrl(q)))) { ctx.flag(`blocked: ${q}`); break; }
    const m = (await ctx.evalJs("document.body.innerText.slice(0,5000)")).match(/~?\s*([0-9,]+)\s*results/i);
    ctx.flag(`"${q}": ${m ? m[1] : "?"} results`);
    await ctx.scroll(this.config.maxScroll);

    // 광고 카드별 "상세정보" 모달 expand → 필드 추출. 카드 좌표는 evalJs로 수집, clickAt로 실제 클릭.
    const triggers = await ctx.evalJs(`JSON.stringify([...document.querySelectorAll(${JSON.stringify("<RECON:DETAIL_TRIGGER_SELECTOR>")})].slice(0, ${this.config.maxScroll * 3}).map(e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:r.width,h:r.height}}).filter(o=>o.w>0&&o.h>0))`);
    for (const t of JSON.parse(triggers || "[]")) {
      if (ctx.limitReached()) break;
      await ctx.clickAt(t.x, t.y);
      const rawJson = await ctx.evalJs(`(function(){
        const q=(s)=>document.querySelector(s); const txt=(s)=>{const e=q(s);return e?e.innerText.trim():"";};
        return JSON.stringify({
          started_at: txt(${JSON.stringify("<RECON:STARTED_AT_SELECTOR>")}),
          platforms: [...document.querySelectorAll(${JSON.stringify("<RECON:PLATFORM_SELECTOR>")})].map(e=>e.getAttribute("aria-label")||e.alt||e.innerText||""),
          advertiser: txt(${JSON.stringify("<RECON:ADVERTISER_SELECTOR>")}),
          follower_raw: txt(${JSON.stringify("<RECON:FOLLOWER_SELECTOR>")}),
          library_id: txt(${JSON.stringify("<RECON:LIBRARY_ID_SELECTOR>")})
        });
      })()`);
      const detail = normalizeDetail(JSON.parse(rawJson || "{}"));
      ctx.flag(`detail ${detail.detail_captured ? "ok" : "miss"}: ${detail.advertiser_name || "?"}`);
      // 모달 닫기 (recon에서 닫기 셀렉터/ESC 확인)
      await ctx.evalJs(`(q=>q&&q.click())(document.querySelector(${JSON.stringify("<RECON:MODAL_CLOSE_SELECTOR>")}))`);
      // detail meta를 다음 drain에 실어보낸다(카드 단위 drain).
      ctx.resetBuffer();
      await ctx.drain(detail);
    }
  }
}
```

> 설계 메모: drain을 카드 단위로 호출(모달 닫은 뒤 `resetBuffer`→`drain(detail)`)하면 그 카드의 이미지/비디오 응답에만 detail meta가 붙는다. recon에서 "모달 안에 큰 해상도 이미지/비디오 응답이 실제로 뜨는지"가 확인되면 이 카드-단위 방식이 가장 정확하다. recon 결과 카드-단위 매핑이 불가능하면(예: 모든 이미지가 그리드에서 한꺼번에 로드됨) recon-notes.md에 적고, 그리드 일괄 drain + detail은 별도 배열로 저장하는 방식으로 IMPLEMENTATION_NOTES에 대안을 기록한다.

- [ ] **Step 3: flow 정적 검증**

Run: `node --check flows/meta-ad-library/flow.mjs && node --test shared`
Expected: 구문 OK + 기존 스위트 그린. 동작 검증은 Task 8 라이브.

- [ ] **Step 4: 커밋**

```bash
git add flows/meta-ad-library/flow.mjs
git commit -m "feat(meta): detail-modal expand loop + videoMatch + drop media_type=image"
```

---

### Task 7: validator 교차검증 업데이트 (image_url OR video_url)

**Files:**
- Modify: `shared/validators/validate-ad-creative.ts:15-19`

- [ ] **Step 1: 교차검증 수정 + detail 카운트 보고**

라인 15-19를 교체:
```ts
// Cross-check: every creative carries image_url OR video_url; report detail-capture coverage.
const list = Array.isArray((data as any).creatives) ? (data as any).creatives : [];
const withMedia = list.filter((c: any) => c.image_url || c.video_url).length;
if (list.length === withMedia) console.log(`PASS  ${list.length} creatives all have image_url or video_url`);
else { console.error(`FAIL  ${list.length - withMedia} creatives missing both image_url and video_url`); ok = false; }
const withDetail = list.filter((c: any) => c.detail_captured).length;
console.log(`INFO  detail_captured: ${withDetail}/${list.length}`);
```

- [ ] **Step 2: 확장 픽스처로 검증 통과 확인**

Run: `npx tsx shared/validators/validate-ad-creative.ts /tmp/ad-sample.json`
Expected: 스키마 PASS + `PASS ... image_url or video_url` + `INFO detail_captured: 1/2`. (Task 2의 /tmp/ad-sample.json 재사용; 없으면 재생성.)

- [ ] **Step 3: 커밋**

```bash
git add shared/validators/validate-ad-creative.ts
git commit -m "feat(validate): accept video_url as media + report detail_captured coverage"
```

---

### Task 8: runbook 문서화 + 라이브 real-data 검증

**Files:**
- Modify: `knowledge/reference/modes/data-collection.md` (메타 절차)

- [ ] **Step 1: runbook 갱신**

`data-collection.md`의 메타 수집 절차에 추가: (a) scroll 후 광고별 "상세정보" 모달 expand → 개시일/플랫폼/광고주/팔로워 추출(`normalizeDetail`), (b) `media_type` 미설정으로 비디오 포함, 비디오는 `videos/ad-N.mp4`(바이트 불가 시 `video_url`만), (c) 모달 미오픈/차단은 STOP + `detail_captured:false` 기록.

- [ ] **Step 2: 라이브 수집 1회 실행 (real-data)**

Task 1과 동일 포트/백그라운드 탭으로 메타 flow를 실제 1회 실행해 `.generate-ads-img/runs/<runId>/ad-creatives/<persona>/ad-creative.json`을 생성. (실행 진입점은 `shared/collect/run-flow.mjs` 계열 — recon에서 확인한 호출 형태 사용.)

- [ ] **Step 3: real-data 검증 기준 확인**

```bash
npx tsx shared/validators/validate-ad-creative.ts .generate-ads-img/runs/<runId>/ad-creatives/<persona>/ad-creative.json
ls .generate-ads-img/runs/<runId>/ad-creatives/<persona>/videos/ 2>/dev/null
```
Expected/확인:
- 스키마 PASS + `image_url or video_url` PASS.
- `detail_captured` 비율 > 0 (모달 필드가 실제로 비어있지 않게 채워짐). 0이면 셀렉터 문제 → recon-notes로 되돌아가 셀렉터 재확정(가짜완료 금지).
- 비디오 광고가 결과에 있으면 `subtype:"video"` 레코드 ≥1, 가능하면 `videos/`에 파일 ≥1.
- 실행 중 사용자 활성 창에서 포커스/커서 탈취 없음(비침습) 확인.
- 차단 시 STOP + `failures/meta_ad_library.json` 트레이스 남는지 확인(은닉 금지).

- [ ] **Step 4: 커밋**

```bash
git add knowledge/reference/modes/data-collection.md
git commit -m "docs(runbook): Meta detail-modal expand + video capture procedure"
```

---

## Self-Review

- **Spec coverage:** A 스키마→Task 2/7, B-1 recon→Task 1, B-2 flow→Task 6, C harness→Task 5, D runbook→Task 8, E 아티팩트→Task 5/8, 검증(테스트 코드)→Task 3/4(순수 단위)+Task 2/7(스키마)+Task 8(real-data). 비범위(검색 각도·다운스트림 보고)는 의도적으로 제외. ✅
- **Placeholder scan:** 셀렉터/비디오 패턴의 `<RECON:*>`는 Task 1이 산출하는 실데이터 값으로, placeholder가 아니라 명시적 의존성(Task 1 → Task 6). 그 외 TODO/TBD 없음. ✅
- **Type consistency:** `classifyResponse`/`buildCreativeRecord`(Task 4) 시그니처가 harness(Task 5)·flow(Task 6) 사용처와 일치. `normalizeDetail` 반환 키(`advertiser_name`/`follower_count`/`platforms`/`started_at`/`library_id`/`detail_captured`)가 스키마(Task 2)·validator(Task 7)와 일치. ✅
