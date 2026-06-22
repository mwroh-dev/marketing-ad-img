# Meta Ad Library — 상세정보 모달 + 비디오 수집 (설계)

- 날짜: 2026-06-22
- 상태: 승인됨 (구현 계획 단계로 이행)
- 트리거: 고객 피드백 — "광고에 대한 정보를 얻을 수 있으면 좋겠다." 메타 광고 라이브러리의 "상세정보" 모달(개시일·게재 플랫폼·광고주명·팔로워 등)과 비디오 광고까지 수집해 아티팩트로 쌓는다.

## 배경 / 현재 상태 (코드 근거)

메타 수집은 **에이전트가 아니라** 다음 3계층으로 동작한다 (커밋 a59399f: 옛 `ad-library-collector` 에이전트는 "결정론적 수집은 LLM 추론이 없다"는 이유로 제거되어 harness+adapter에 흡수됨 — `no dedicated collector subagent by design`):

- runbook: `knowledge/reference/modes/data-collection.md` (절차)
- harness: `shared/collect/ad-collect-harness.mjs` (CDP 생명주기·캡처·dedup·STOP-on-block)
- 메타 adapter: `flows/meta-ad-library/flow.mjs` (메타 전용 흐름)

현재 한계:
- 메타 flow는 `navigate → 결과수 read → scroll → 이미지 drain`만 수행. **광고별 "상세정보" 모달을 절대 열지 않음** (그리드 뷰만 스크레이프).
- 이미지는 네트워크 응답 sniffing(`imgMatch`: fbcdn `t39.35426`)으로만 캡처. **비디오 매처 없음.**
- harness가 `subtype:"single_image"` 하드코딩.
- 메타 필터 URL에 `media_type:"image"` 하드코딩 → 비디오 광고가 소스 단에서 제외됨.
- 스키마(`schemas/collection/ad-creative.schema.json`)는 `started_at`·`platforms`·`advertiser`/`advertiser_id`·`subtype:"video_thumb"`를 **선언만** 하고 아무도 채우지 않음. `follower_count`·`video_url`/`video_file`은 없음. `additionalProperties:false`라 신규 필드는 스키마 수정 필요.

기존 재사용 자산: `ctx.clickAt`(실제 마우스 클릭, 백그라운드 탭), `ctx.evalJs`(in-page DOM 읽기), `drain(meta)`(임의 per-creative 메타 병합) — 모두 메타 flow가 아직 미사용. URL 화이트리스트(`matchToolEntry`)는 navigation만 검사하므로 in-page 모달 클릭은 게이트 대상 아님.

## 결정 사항 (확정)

- **새 에이전트 신설하지 않음.** flow + harness + 스키마 + runbook 확장으로 구현. (제거 사유와 충돌 회피)
- 1차 스펙 범위 = (1) 상세정보 모달 수집 + (2) 비디오 수집 + (3) 스키마 확장. **검색 각도(키워드/경쟁사) 확장은 별도 2차 스펙으로 분리.**
- 순서: **스키마 → 라이브 CDP recon → flow/harness 확장 → 아티팩트 출력 → 검증.**
- CDP는 비침습(백그라운드 탭, bringToFront/포커스 탈취 금지) + STOP-on-block 유지.

## 비범위 (이번 스펙 제외)

- 키워드 검색 각도 (#3) / 경쟁사명 검색 각도 (#4) — 2차 스펙.
- 모달 필드에 대한 LLM 분석/추론 (analysis 단계 소관). 이번엔 **수집(원시 추출)만**.
- 광고 카피 의미 분석, 레이아웃, 패턴 — 기존 analysis 에이전트 소관.

## 설계

### A. 스키마 확장 — `schemas/collection/ad-creative.schema.json`

per-creative에 추가/활성화:
- 비디오: `video_url`(string), `video_file`(string, 예 `videos/ad-N.mp4`). `subtype` enum에 `"video"` 추가(또는 기존 `"video_thumb"` 의미 명확화).
- 상세정보: `follower_count`(integer, **신규**), `detail_captured`(boolean, 모달 열림/추출 성공 플래그, **신규**).
- 기존이지만 채우기: `started_at`(개시일), `platforms`(게재 플랫폼 배열), `advertiser`/`advertiser_id`(광고주), `library_id`.

> 정확한 필드명/타입/존재 여부는 **B-1 recon 결과로 최종 확정.** 위는 타깃 셋이며 recon이 "백그라운드 탭 DOM에서 실제 추출 가능한가"를 검증해 확정한다. recon에서 어떤 필드가 DOM에 없거나 백그라운드에서 안 잡히면 스키마에서 제외하고 `IMPLEMENTATION_NOTES`에 사유 기록.

### B. flow 확장 — `flows/meta-ad-library/flow.mjs`

**B-1. 라이브 CDP recon (구현 1단계, 결정론적 코딩 전 선행):**
- `shared/collect/acquire-port.mjs`로 포트 확보 → 백그라운드 탭에서 메타 광고 라이브러리 실제 검색 결과를 연다.
- `evalJs`로 "상세정보" 모달의 DOM 구조를 떠서: 개시일·게재 플랫폼·광고주명·팔로워를 잡는 셀렉터 확정.
- 비디오 광고 응답의 네트워크 URL 패턴 확정(비디오 매처). "백그라운드 탭 DOM 읽기로 충분한가 vs 네트워크 탭 캡처가 필요한가"를 여기서 판가름.
- 결과를 recon 노트로 남기고 A의 스키마/매처를 확정.

**B-2. flow 본구현:**
- 기존 흐름 뒤에 **광고별 루프**: `clickAt`로 "상세정보" 클릭 → 모달 대기 → `evalJs`로 필드 추출 → `drain(meta)`로 병합 → 모달 닫기 → 다음 광고. 모달 미오픈 시 `detail_captured:false`로 기록 후 진행(은닉 금지).
- `media_type:"image"` 제약 해제 → 비디오 광고 포함. B-1에서 확정한 비디오 매처 추가.

### C. harness 확장 — `shared/collect/ad-collect-harness.mjs`

- 하드코딩 `subtype:"single_image"` → image/video 동적 판정.
- 비디오 바이트 캡처 경로(`getResponseBody` → `videos/ad-N.mp4`) 추가.
- `drain(meta)`는 이미 임의 메타 병합 지원 → 모달 필드를 그대로 흘려보냄(코드 변경 최소).

### D. runbook 갱신 — `knowledge/reference/modes/data-collection.md`

- 메타 절차에 "상세정보 모달 expand → 필드 추출" 단계 + 비디오 캡처 단계 문서화.
- STOP-on-block / 비침습 / `detail_captured` 기록 규칙 명시.

### E. 아티팩트 출력

- 기존 `ad-creative.json` + `images/` 에 더해: `videos/` 디렉토리, 각 creative에 상세정보 필드 + `detail_captured`.

## 검증 (완료 정의 — 비-가짜완료)

**테스트 코드 작성이 검증의 핵심.** 스키마는 만들었는데 코드가 그에 안 맞을 수 있으므로, 자동 테스트로 스키마↔코드 정합을 강제한다.

테스트 코드 (구현의 필수 산출물):
1. **스키마↔파서 정합 단위 테스트** — flow/harness가 생성하는 creative 레코드 샘플(상세정보 필드 + 비디오 필드 포함)이 확장된 스키마 validator를 PASS하는지. 신규 필드(`follower_count`/`video_url`/`video_file`/`detail_captured`)와 채워지는 기존 필드(`started_at`/`platforms`/`advertiser`)가 모두 검증되어야 함. `additionalProperties:false` 위반 회귀 방지.
2. **harness subtype 판정 테스트** — image/video 입력에 따라 `subtype`이 올바르게 동적 판정되는지(하드코딩 회귀 방지).
3. **추출 파서 테스트** — recon으로 확보한 실제 모달 DOM 스냅샷(fixture)을 입력으로 개시일/플랫폼/광고주/팔로워 추출 함수가 기대값을 반환하는지. 모달 미오픈 fixture → `detail_captured:false`.

real-data 실행 기준 (테스트와 별개, 1회 라이브 확인):
4. recon으로 확정한 실제 광고 1세트 수집 시 모달 필드가 **실제로 비어있지 않게** 채워짐 — `detail_captured:true` 비율 보고.
5. 비디오 광고 1건 이상이 `videos/`에 실제 저장되고 `subtype:"video"`로 기록.
6. 백그라운드 탭에서 사용자 포커스/커서 탈취 없음(비침습) 확인.
7. 차단/모달 미오픈 케이스는 STOP + `detail_captured:false`로 노출(에러 은닉 금지).

## 후속 (이번 스펙에서 defer — 별도 작업)

- **다운스트림 소비 에이전트의 아티팩트 보고**: 수집 결과(상세정보+비디오)가 쌓이면, 그걸 받아 처리하는 에이전트(analysis 단계 등)가 "이러이러한 정보가 N건 쌓였습니다"라고 사용자에게 보여주는 흐름. 에이전트 자체는 변경 안 했지만 신규 아티팩트를 인지/언급하도록 contract에 한 줄 추가가 필요할 수 있음. **기능 개발 후 별도로 다룬다.**

## 리스크

- 백그라운드 탭 제약으로 모달 DOM 읽기가 불안정할 수 있음(과거 이미지 수집이 네트워크 탭으로 간 이유). → B-1 recon이 이 리스크를 1단계에서 해소.
- 메타가 모달 클릭/연속 expand를 봇으로 탐지해 차단할 수 있음 → STOP-on-block, 우회 금지.
- 셀렉터는 메타 DOM 변경에 취약 → recon 노트에 셀렉터 근거를 남겨 유지보수 가능하게.
