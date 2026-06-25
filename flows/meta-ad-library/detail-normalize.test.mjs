import test from "node:test";
import assert from "node:assert/strict";
import { parseFollowerCount, parseStartedAt, mapPlatforms, normalizeStatus, normalizeDetail, normalizeAdCopy, normalizeAdvertiser } from "./detail-normalize.mjs";

test("normalizeAdvertiser strips the collab wrapper, passes a normal name through", () => {
  // live bug: branded-content ad → "{advertiser} 페이지는 {partner}과(와) 함께합니다"
  assert.equal(normalizeAdvertiser("trend__mandu 페이지는 ChatGPT과(와) 함께합니다"), "trend__mandu");
  assert.equal(normalizeAdvertiser("그녀의 다이어리"), "그녀의 다이어리");        // normal name unchanged
  assert.equal(normalizeAdvertiser("스텐드랩 - STEND LAB"), "스텐드랩 - STEND LAB"); // hyphenated name unchanged
  assert.equal(normalizeAdvertiser(""), "");
  assert.equal(normalizeAdvertiser(null), "");
});

test("normalizeDetail uses the collab-stripped advertiser", () => {
  assert.equal(normalizeDetail({ advertiser: "trend__mandu 페이지는 ChatGPT과(와) 함께합니다" }).advertiser_name, "trend__mandu");
});

test("normalizeAdCopy collapses whitespace, trims, caps length; empty → ''", () => {
  assert.equal(normalizeAdCopy("  촉촉한   보습\n크림  "), "촉촉한 보습 크림");
  assert.equal(normalizeAdCopy(""), "");
  assert.equal(normalizeAdCopy(null), "");
  assert.equal(normalizeAdCopy("x".repeat(3000)).length, 2000);
});

test("normalizeDetail carries ad_copy when present, omits it when blank", () => {
  assert.equal(normalizeDetail({ ad_copy: "  세일 중  " }).ad_copy, "세일 중");
  assert.equal("ad_copy" in normalizeDetail({ status: "활성" }), false);
});

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
  // EN anchor: bare number without K/M/B suffix and without "followers" must not parse as a count
  assert.equal(parseFollowerCount("width: 2px"), null);
  assert.equal(parseFollowerCount("-387px -766px"), null);
});

test("normalizeDetail tolerates null / undefined raw (no TypeError)", () => {
  assert.deepEqual(normalizeDetail(null), { detail_captured: false });
  assert.deepEqual(normalizeDetail(undefined), { detail_captured: false });
  assert.deepEqual(normalizeDetail({}), { detail_captured: false });
});

test("parseStartedAt handles KR and EN date formats", () => {
  assert.equal(parseStartedAt("2026. 2. 26.에 게재 시작함"), "2026-02-26");
  assert.equal(parseStartedAt("Started running on 26 Feb 2026"), "2026-02-26");
  assert.equal(parseStartedAt("26 Feb 2026"), "2026-02-26");
  assert.equal(parseStartedAt("Feb 26, 2026"), "2026-02-26");        // Mon D, YYYY (locale variant)
  assert.equal(parseStartedAt("Started running on Feb 1, 2026"), "2026-02-01");
  assert.equal(parseStartedAt(""), null);
  assert.equal(parseStartedAt("게재 시작 정보 없음"), null);
});

test("mapPlatforms resolves known offsets, keeps unknown", () => {
  assert.deepEqual(mapPlatforms(["-387px -766px", "-387px -805px"]), ["facebook", "instagram"]);
  assert.deepEqual(mapPlatforms(["-387px -766px", "-387px -805px", "-387px -818px", "-387px -831px"]),
    ["facebook", "instagram", "messenger", "threads"]);
  assert.deepEqual(mapPlatforms(["-387px -999px"]), ["unknown(-999px)"]);
  assert.deepEqual(mapPlatforms([]), []);
  // recon §10d: -753px visually confirmed as Audience Network (5-platform ad, render order F·I·AN·M·T)
  assert.deepEqual(
    mapPlatforms(["-387px -766px", "-387px -805px", "-387px -753px", "-387px -818px", "-387px -831px"]),
    ["facebook", "instagram", "audience_network", "messenger", "threads"]);
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
