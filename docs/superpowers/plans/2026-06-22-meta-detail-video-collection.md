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
- properties에 다음 추가 (recon에서 전부 in-modal 추출 확정. `platforms`·`started_at`은 기존 필드 재사용):
```json
"video_url": { "type": "string" },
"video_file": { "type": "string" },
"video_duration": { "type": "string" },
"follower_count": { "type": ["integer", "null"], "minimum": 0 },
"status": { "type": "string", "enum": ["active", "inactive", "unknown"] },
"page_category": { "type": "string" },
"page_id": { "type": "string" },
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

**Interfaces (recon-실측 반영):**
- 입력 raw 객체 형태 (Task 6 flow가 in-page evalJs로 생성, recon §8d 픽스처와 동일):
  `{ status?, library_id?, started_at?, advertiser?, follower_raw?, category?, page_id?, platform_offsets?: string[], video_duration? }`
- Produces:
  - `parseFollowerCount(raw: string|null): number|null` — KR `"팔로워 35명"`→35, `"팔로워 1.2천명"`→1200, `"3만"`→30000, `"1.2억"`→120000000; EN `"12,345 followers"`→12345, `"1.2K followers"`→1200; 빈/널/파싱불가→null. (KR 단위 천=1e3·만=1e4·억=1e8, EN K/M/B.)
  - `parseStartedAt(raw: string|null): string|null` — KR `"2026. 2. 26.에 게재 시작함"`→`"2026-02-26"`; EN `"Started running on 26 Feb 2026"`/`"26 Feb 2026"`→`"2026-02-26"`; 파싱불가→null.
  - `mapPlatforms(offsets: string[]): string[]` — mask-position 문자열(`"-387px -766px"`)의 Y-offset을 테이블로 매핑(`-766px`→facebook, `-805px`→instagram, `-818px`→messenger, `-831px`→threads); 모르는 offset→`"unknown(<yoffset>)"`. 빈 입력→`[]`.
  - `normalizeStatus(raw: string|null): "active"|"inactive"|"unknown"` — `활성`/`Active`→active, `비활성`/`Inactive`→inactive, else unknown.
  - `normalizeDetail(raw): { status?, library_id?, started_at?, advertiser_name?, follower_count?, page_category?, page_id?, platforms?, video_duration?, detail_captured: boolean }` — 위 파서들로 조립, 문자열 trim, 의미있는 필드가 하나라도 있으면 `detail_captured:true`, 빈 입력이면 `{detail_captured:false}`.
- Consumes: Task 6의 flow가 in-page evalJs로 만든 raw 객체.

- [ ] **Step 1: 실패하는 테스트 작성 (recon §8d 실측 픽스처 사용)**

`flows/meta-ad-library/detail-normalize.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseFollowerCount, parseStartedAt, mapPlatforms, normalizeStatus, normalizeDetail } from "./detail-normalize.mjs";

test("parseFollowerCount handles KR 명/천/만/억 and EN K/M, commas, junk", () => {
  assert.equal(parseFollowerCount("팔로워 35명"), 35);
  assert.equal(parseFollowerCount("팔로워 192명"), 192);
  assert.equal(parseFollowerCount("팔로워 1.2천명"), 1200);
  assert.equal(parseFollowerCount("3만"), 30000);
  assert.equal(parseFollowerCount("1.2억"), 120000000);
  assert.equal(parseFollowerCount("12,345 followers"), 12345);
  assert.equal(parseFollowerCount("1.2K followers"), 1200);
  assert.equal(parseFollowerCount(""), null);
  assert.equal(parseFollowerCount(null), null);
  assert.equal(parseFollowerCount("팔로워 없음"), null);
});

test("parseStartedAt handles KR and EN date formats", () => {
  assert.equal(parseStartedAt("2026. 2. 26.에 게재 시작함"), "2026-02-26");
  assert.equal(parseStartedAt("Started running on 26 Feb 2026"), "2026-02-26");
  assert.equal(parseStartedAt("26 Feb 2026"), "2026-02-26");
  assert.equal(parseStartedAt(""), null);
  assert.equal(parseStartedAt("게재 시작 정보 없음"), null);
});

test("mapPlatforms resolves known offsets, keeps unknown", () => {
  assert.deepEqual(mapPlatforms(["-387px -766px", "-387px -805px"]), ["facebook", "instagram"]);
  assert.deepEqual(mapPlatforms(["-387px -766px", "-387px -805px", "-387px -818px", "-387px -831px"]),
    ["facebook", "instagram", "messenger", "threads"]);
  assert.deepEqual(mapPlatforms(["-387px -999px"]), ["unknown(-999px)"]);
  assert.deepEqual(mapPlatforms([]), []);
});

test("normalizeStatus maps KR/EN", () => {
  assert.equal(normalizeStatus("활성"), "active");
  assert.equal(normalizeStatus("Active"), "active");
  assert.equal(normalizeStatus("비활성"), "inactive");
  assert.equal(normalizeStatus("???"), "unknown");
});

test("normalizeDetail assembles a real recon fixture (KR, accordion expanded)", () => {
  const out = normalizeDetail({
    status: "활성", library_id: "1972922693648310",
    started_at: "2026. 2. 26.에 게재 시작함", advertiser: "진시황의 비밀",
    follower_raw: "팔로워 35명", category: "건강/뷰티", page_id: "275345032325614",
    platform_offsets: ["-387px -766px", "-387px -805px"], video_duration: "0:00 / 0:43",
  });
  assert.equal(out.status, "active");
  assert.equal(out.library_id, "1972922693648310");
  assert.equal(out.started_at, "2026-02-26");
  assert.equal(out.advertiser_name, "진시황의 비밀");
  assert.equal(out.follower_count, 35);
  assert.equal(out.page_category, "건강/뷰티");
  assert.equal(out.page_id, "275345032325614");
  assert.deepEqual(out.platforms, ["facebook", "instagram"]);
  assert.equal(out.video_duration, "0:00 / 0:43");
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
// Pure normalization of the Meta detail-modal raw fields scraped in-page (recon-verified, KR⊥EN).
// Selectors live in flow.mjs (live-confirmed via recon-notes.md); this module is the testable cleanup layer.

const KR_MULT = { 천: 1e3, 만: 1e4, 억: 1e8 };
const EN_MULT = { k: 1e3, m: 1e6, b: 1e9 };

export function parseFollowerCount(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  // KR: number + optional 천/만/억 (+ optional 명)
  let m = s.match(/([\d.,]+)\s*(천|만|억)?\s*명/);
  if (!m) m = s.match(/([\d.,]+)\s*(천|만|억)/);
  if (m) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(num)) return null;
    return Math.round(num * (m[2] ? KR_MULT[m[2]] : 1));
  }
  // EN: number + optional K/M/B (+ optional "followers")
  m = s.match(/([\d.,]+)\s*([KMBkmb])?\s*(?:followers?)?/i);
  if (m && m[1] && /\d/.test(m[1])) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(num)) return null;
    return Math.round(num * (m[2] ? EN_MULT[m[2].toLowerCase()] : 1));
  }
  return null;
}

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad = (n) => String(n).padStart(2, "0");

export function parseStartedAt(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  // KR: "2026. 2. 26.에 게재 시작함" → extract "2026. 2. 26"
  let m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  // EN: "...26 Feb 2026"
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${pad(mo)}-${pad(+m[1])}`;
  }
  return null;
}

// mask-position Y-offset → platform. recon §8c (🟡 best-inference; keep raw offset for unknowns).
const PLATFORM_BY_YOFFSET = { "-766px": "facebook", "-805px": "instagram", "-818px": "messenger", "-831px": "threads" };

export function mapPlatforms(offsets) {
  if (!Array.isArray(offsets)) return [];
  return offsets.map((o) => {
    const y = String(o).trim().split(/\s+/).pop();   // "-387px -766px" → "-766px"
    return PLATFORM_BY_YOFFSET[y] || `unknown(${y})`;
  });
}

export function normalizeStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "활성" || s === "active") return "active";
  if (s === "비활성" || s === "inactive") return "inactive";
  return "unknown";
}

export function normalizeDetail(raw = {}) {
  const out = {};
  const status = normalizeStatus(raw.status);
  if (raw.status != null && String(raw.status).trim()) out.status = status;
  const lib = (raw.library_id ?? "").toString().trim();
  if (lib) out.library_id = lib;
  const started = parseStartedAt(raw.started_at);
  if (started) out.started_at = started;
  const adv = (raw.advertiser ?? "").toString().trim();
  if (adv) out.advertiser_name = adv;
  const fc = parseFollowerCount(raw.follower_raw);
  if (fc != null) out.follower_count = fc;
  const cat = (raw.category ?? "").toString().trim();
  if (cat) out.page_category = cat;
  const pid = (raw.page_id ?? "").toString().trim();
  if (pid) out.page_id = pid;
  const platforms = mapPlatforms(raw.platform_offsets);
  if (platforms.length) out.platforms = platforms;
  const dur = (raw.video_duration ?? "").toString().trim();
  if (dur) out.video_duration = dur;
  out.detail_captured = Object.keys(out).length > 0;
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test flows/meta-ad-library/detail-normalize.test.mjs`
Expected: PASS (6 tests).

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

test("classifyResponse prefers video then image then null, uses mime", () => {
  const a = { imgMatch: (u) => u.includes("img"), videoMatch: (u, mime) => /^video\//.test(mime) || u.includes("vid") };
  assert.equal(classifyResponse("https://x/vid.mp4", a), "video");
  assert.equal(classifyResponse("https://x/anything", a, "video/mp4"), "video");   // mime-led
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
// Classify a network response for an adapter: video takes precedence over image.
// mime is passed through (Meta videos are reliably mime=video/mp4; URL alone is a weaker signal).
export function classifyResponse(url, adapter, mime = "") {
  if (adapter && typeof adapter.videoMatch === "function" && adapter.videoMatch(url, mime)) return "video";
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
  const kind = classifyResponse(u, adapter, (p.response && p.response.mimeType) || "");
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

### Task 6: 메타 flow — 모달 expand 루프 + 비디오 매처 + media_type 해제 (라이브 빌드+검증)

이 태스크는 CDP 라이브가 필요해 순수 단위테스트로 닫히지 않는다. 구현자는 recon-notes.md(§2·§8)를 셀렉터 SOT로 쓰고, **실제 CDP로 돌려가며** flow를 완성·검증한다. acquire-port → launch-chrome(헤드리스, ko-KR Accept-Language) → attach 패턴은 Task 1 _recon 스크립트와 동일.

**Files:**
- Modify: `flows/meta-ad-library/flow.mjs`

**Interfaces:**
- Consumes: `normalizeDetail` (Task 3), ctx 프리미티브 `evalJs`/`clickAt`/`scroll`/`drain`/`resetBuffer` (harness, Task 5 적용본).
- 셀렉터/패턴/오프셋의 SOT = `flows/meta-ad-library/recon-notes.md` (전부 라이브 검증값). 추측 금지.

- [ ] **Step 1: videoMatch + media_type 해제**

`flows/meta-ad-library/flow.mjs`:
- import 추가: `import { normalizeDetail } from "./detail-normalize.mjs";`
- `imgMatch` 다음 줄에 `videoMatch` 추가 (recon §4 — mime 우선, URL fallback):
```js
videoMatch: (u, mime = "") =>
  /^video\//i.test(mime) ||
  (/\.mp4(\?|$)/i.test(u) && /video-[a-z0-9-]+\.fbcdn\.net/i.test(u)),
```
- `config`에서 `media_type: "image"` **제거** (키 삭제 → 비디오 포함; recon §0 front-door는 media_type 없이 비디오 노출 확인).

- [ ] **Step 2: 광고별 모달 expand → 필드 추출 → 아코디언 expand → drain 루프**

`collect(ctx)`에 광고별 루프를 구현한다. recon에서 확정된 사실(반드시 반영):
- **detail 트리거**(recon §8a): `div[role="button"]` 중 innerText가 `/^(See ad details|광고 상세 정보 보기|상세정보)$/` (summary 변형 `요약 세부 사항 보기`/`See summary details`는 제외).
- **모달 열기 GOTCHA**(recon §2): 캐시 좌표는 reflow로 빗나감. `scrollIntoView({block:'center'})` → **클릭 직전 좌표 재읽기** → `ctx.clickAt(x,y)` (CDP 실클릭). `el.click()`로 expand 대체 금지.
- **모달 식별**(recon §2): `[role="dialog"]` 중 텍스트에 `Library ID|라이브러리` 포함 + 가장 긴 것.
- **필드는 `dialog.innerText` flat-line regex로 추출**(recon §2 표, §8): `library_id`=`(?:Library ID|라이브러리 ID):\s*([0-9]+)`(첫 매치), `started_at`=`(?:Started running on|게재 시작)` 인접 + `2026. 2. 26.`/`26 Feb 2026` 패턴 원문, `status`=`^(Active|Inactive|활성|비활성)$` 라인, `advertiser`=`Sponsored`/`광고` 라인 바로 윗줄.
- **아코디언 expand**(recon §8b): dialog 안 텍스트가 정확히 `광고주 정보`/`About the advertiser`/`Advertiser info`인 leaf 요소 → scrollIntoView → 좌표 재읽기 → **CDP 실클릭**(el.click 토글 안 됨). 펼친 뒤 dialog.innerText에서 `follower_raw`=`팔로워\s*([0-9][0-9.,]*\s*(?:천|만|억)?\s*명?)`(EN: `([0-9][0-9.,]*[KMB]?)\s*followers`), `category`(팔로워 줄 다음), `page_id`=`ID:\s*([0-9]+)`(accordion 내).
- **platforms**(recon §8c): `플랫폼`/`Platforms` 라벨 컨테이너의 각 아이콘에 `getComputedStyle(el).maskPosition`(또는 `webkitMaskPosition`)을 읽어 순서대로 문자열 배열 → `platform_offsets`로 raw 그대로 전달(매핑은 `normalizeDetail`/`mapPlatforms`가 담당).
- 위 raw들을 한 객체 `{status, library_id, started_at, advertiser, follower_raw, category, page_id, platform_offsets, video_duration}`로 모아 `normalizeDetail(raw)` → detail meta.
- **모달 닫기**(recon §3): ESC 키 이벤트(`Input.dispatchKeyEvent` rawKeyDown+keyUp). aria close 버튼 의존 금지.

**이미지↔상세 연결(association) — 라이브로 확정할 설계 결정:** 그리드 스크롤 시 이미지/비디오 응답이 이미 버퍼링되므로, 카드와 creative를 1:1로 묶는 방법을 라이브로 검증해 택1하고 그 근거를 `recon-notes.md`(또는 IMPLEMENTATION_NOTES)에 기록한다:
- (A) **카드 단위**: 카드별로 `resetBuffer()` → 모달 열기(모달이 그 광고 creative를 새로 로드하면 그 응답만 버퍼됨) → 필드 추출 → `drain(detail)`. 모달이 새 이미지/비디오 응답을 일으키는지 라이브 확인 필요(캐시면 새 응답 없음 → getResponseBody evict 가능).
- (B) **그리드 일괄 + 순서 매핑**: 기존처럼 그리드 스크롤 후 한 번에 `drain`하고, detail은 카드 순서 배열로 모아 creative와 인덱스로 병합. 단 네트워크 응답 순서 ≠ 카드 순서일 수 있음 → 신뢰도 라이브 확인.
구현자는 A를 먼저 시도하고, 모달이 새 creative 응답을 일으키지 않으면 B로 전환하되 매핑 신뢰도를 flag로 노출한다. 어느 쪽이든 detail이 엉뚱한 creative에 붙으면 안 됨(가짜연결 금지) — 불확실하면 detail을 creative에 병합하지 말고 `result`에 별도 `ad_details[]` 배열로 보관하고 그 사실을 flag로 남긴다.

각 CDP 스텝은 타임아웃 바운드(harness ctx가 이미 sleep 내장; 추가 대기는 `Promise.race`). 차단/모달 미오픈 → 더 우회 말고 그 카드 `detail_captured:false`로 두고 진행, 반복 차단이면 STOP.

- [ ] **Step 3: 라이브 검증 (real-data)**

acquire-port + launch-chrome로 `q=비타민`(또는 임의 KR 키워드) 1회 수집 실행 → `.generate-ads-img/runs/<runId>/ad-creatives/<persona>/ad-creative.json` 생성. 확인:
- `detail_captured:true` creative ≥1 이고 그 안에 `started_at`(ISO)·`advertiser_name`·`follower_count`(숫자)·`platforms`(비어있지 않음)가 실제로 채워짐. 0이면 셀렉터 회귀 → recon-notes로 되돌아가 수정(가짜완료 금지).
- 비디오 광고가 결과에 있으면 `subtype:"video"` + `video_url` 레코드 ≥1.
- 실행 중 사용자 활성 창 포커스/커서 탈취 없음(비침습).
- `node --check flows/meta-ad-library/flow.mjs && node --test shared` 그린(기존 스위트 회귀 없음).

- [ ] **Step 4: 커밋**

```bash
git add flows/meta-ad-library/flow.mjs flows/meta-ad-library/recon-notes.md
git commit -m "feat(meta): detail-modal+accordion expand loop, platform offsets, videoMatch, drop media_type=image"
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
