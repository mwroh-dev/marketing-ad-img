# Google Ads Transparency — collection navigation reference 

Observed facts for navigating the public Google Ads Transparency Center (live-verified, not third-party docs).

## 1. 진입은 URL 파라미터가 아니라 검색박스 상호작용
- `?region=KR&text=<q>` 가설은 **작동 안 함** — `text=`는 SerpApi 관례지 native 파라미터가 아니다. `text=` 붙여도 동일 랜딩(검색박스)만 렌더, advertiser 결과 0.
- native는 **Angular Material SPA**: 홈 `https://adstransparency.google.com/?region=KR` → 단일 `<input>`(placeholder 없음, type=text)에 **실타이핑** → `<material-select-item role="option" class="item">` 자동완성 목록(광고주명·인증·국가·광고수) → **실클릭** → 광고주 페이지 이동.
- 제안 항목은 `/advertiser/AR` href를 직접 노출하지 않음(클릭 시 JS 네비게이션).

## 2. 제안 실클릭은 hover 시퀀스 필수
- `mousePressed`+`mouseReleased`만으론 **착지 실패**(URL 홈 유지). `mouseMoved`(hover) → `mousePressed` → `mouseReleased` 전체 시퀀스라야 네비게이션 발생. (lib `realClickAt`엔 hover가 없어 Google엔 부족 → 하네스에 hover 포함 클릭 프리미티브 필요.)
- ArrowDown+Enter(실키) 경로도 단독으론 착지 실패. → hover-클릭이 정답.
- 검증: 입력 "Tesla" → 첫 제안 hover-클릭 → `/advertiser/AR06713485576768585729?region=KR` 착지 → simgad 23개 캡처.

## 3. 광고주 페이지 = 직접 URL 작동
- `https://adstransparency.google.com/advertiser/AR<id>?region=KR` 직접 navigate 시 그 광고주 광고 렌더(Tesla AR1782… → 13개). AR id를 알면 재진입 가능(provenance/재실행).

## 4. 크리에이티브 이미지 호스트 + 추출경로
- 광고 이미지 = `https://tpc.googlesyndication.com/archive/simgad/<numericId>`. 나머지 `<img>`는 국기아이콘(`google.com/images/flags`) → 제외.
- **`imgMatch = /tpc\.googlesyndication\.com\/archive\/simgad/`**.
- 이미지가 DOM `<img>` + 네트워크 응답 둘 다 → **Meta식 `Network.getResponseBody`(simgad 매칭) 그대로** 사용. RPC 파싱 불필요.
- (참고) 내부 RPC: `…/anji/_/rpc/SearchService/SearchCreatives`(광고목록), `LookupService/GetAdvertiserById`. POST 조립은 해키 → 회피. 이미지가 평범한 GET이라 불필요.

## 5. region 의미 + 차단
- `region=KR` = **광고 게재 지역** 필터지 광고주 본사 아님(Tesla 검색→미국 광고주들). KR 경쟁사는 한글 브랜드명으로 검색해야 KR 광고주가 뜸.
- 로그인/동의월/봇월 **관찰 안 됨**(공개, KR headless). `isBlocked` 추가 패턴 불필요(현재까지). 차단 시 STOP 원칙 유지.

## 6. 하이브리드 모델 정정 (실측 반영)
- spec §4의 "폴백 = 그 경쟁사의 도메인/text 검색 결과에서 크리에이티브 수집"은 **Google엔 그런 결과 페이지가 없다**(검색은 광고주 제안만 반환). 
- → Google 실효 모델 = **advertiser-resolve-or-skip**: 제안에서 광고주 해소되면 그 페이지 수집(`resolved_via:"advertiser"`), 제안 없으면 **수집 없이 coverage flag**(`no_advertiser_match`). 별도 크리에이티브 소스로서의 text_fallback은 degenerate.
- 도메인 검색(웹사이트 입력)도 동일하게 광고주 제안으로 해소됨.

## 7. 컬렉터/하네스에 주는 함의
- 하네스 `ctx`는 `goto/scroll/evalJs/drain`만으론 부족 — **`type(text)`(실타이핑)·`clickSuggestion()`(hover 포함 실클릭)** 프리미티브 필요. (Meta=URL단일홉은 goto만으로 충분, Google=멀티홉+상호작용.)
- 제안 다수일 때 **최선 일치 광고주 선택**(정확/근접 브랜드명) 필요, 기본은 상위(광고수 많은 순). 현 프로브는 첫 제안 클릭.

## 확정값 요약 (어댑터에 박을 값)
```
homeUrl       = https://adstransparency.google.com/?region=KR
advertiserUrl = https://adstransparency.google.com/advertiser/<AR id>?region=KR
searchInput   = document.querySelector('input')
suggestionSel = material-select-item[role=option]
imgMatch      = /tpc\.googlesyndication\.com\/archive\/simgad/
extraction    = Network.getResponseBody on imgMatch responses (Meta-style)
click         = mouseMoved → mousePressed → mouseReleased (hover required)
typing        = per-char Input.dispatchKeyEvent (ASCII) / Input.insertText (한글)
entry model   = advertiser-resolve-or-skip (no text-results creative page)
```
