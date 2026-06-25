import test from "node:test";
import assert from "node:assert/strict";
import flow from "./flow.mjs";

// MODAL-DRIVEN model (rearch): captureAndCollect drives collection 1:1 from the modal pass — for each ad it
// opens the modal, extracts detail, reads that ad's creative asset(s), and calls ctx.collectCreative per asset
// with this ad's detail attached. There is no buffer→drain join (Meta retired it). These tests drive
// captureAndCollect with a scripted fake ctx (no browser) and assert on the recorded collectCreative calls:
// ONE creative per ad (per-ad detail 1:1; multi-rendition ads are NOT inflated), modal-fail fallback
// (detail_captured false via the grid card img), and the video record (video-only: <video>.src carried as
// videoKey, NO poster image so a video's first frame never pollutes the image corpus).

// Build a fake ctx scripting a sequence of cards. Each card:
//   { cardAssets:[{full,key}], modalAssets:[{full,key}]|null, modalFails?, libid, advertiser, follower,
//     page_id, videoUrl? }
// The fake answers each in-page expression by matching a recognizable substring, models dialog open/close,
// and RECORDS every collectCreative call so tests can assert the produced records.
function makeCtx(cards, { cap = 24, imagesPerQuery } = {}) {
  let i = -1;                 // current card index (advanced when CARD_IMG_ASSETS([n]) is read)
  let dialogOpen = false;
  const flags = [];
  const collected = [];       // every collectCreative arg (the produced records, pre-buildCreativeRecord)
  const ctx = {
    flag: (s) => flags.push(s),
    sleep: async () => {},
    scroll: async () => {},   // mock list is fixed → a scroll loads no new cards (drives exhaustion detection)
    imagesPerQuery,           // per-keyword IMAGE cap (undefined → Infinity in captureAndCollect)
    clickAt: async () => {},  // accordion click — no-op in the mock (HAS_FOLLOWER is scripted true)
    esc: async () => { dialogOpen = false; },
    limitReached: () => collected.length >= cap,
    pollUntil: async (expr) => { try { return !!(await ctx.evalJs(expr)); } catch { return false; } },
    collectCreative: async (arg) => {
      if (collected.length >= cap) return { collected: false, reason: "cap" };
      collected.push(arg);
      return { collected: true, index: collected.length - 1 };
    },
    async evalJs(expr) {
      if (/\.length\s*$/.test(expr) && expr.includes('role="button"')) return cards.length;     // trigger count
      if (expr.includes("_7jyr")) return cards[i] ? (cards[i].cardText || "") : "";              // CARD_PRIMARY_TEXT(i) — does NOT advance cursor (must precede the k<12 walk match)
      if (expr.includes("for(let k=0;k<12")) {                 // CARD_IMG_ASSETS(i) — advance the cursor
        const m = expr.match(/\]\[(\d+)\]/);
        i = m ? Number(m[1]) : i + 1;
        return cards[i] ? cards[i].cardAssets : [];
      }
      if (expr.includes("d.querySelectorAll('img')")) {        // MODAL_IMG_ASSETS
        const c = cards[i];
        return c && c.modalAssets ? c.modalAssets : [];
      }
      if (expr.includes("b.click()")) {                        // open the modal (unless this card fails)
        if (cards[i] && cards[i].modalFails) return true;      // click "happens" but dialog never appears
        dialogOpen = true; return true;
      }
      if (expr.includes("scrollTo(0,0)")) return null;
      if (expr.trim().startsWith("!!(")) return dialogOpen && !(cards[i] && cards[i].modalFails);  // !!DLG
      if (expr.includes("Close|닫기")) { dialogOpen = false; return null; }   // CLOSE_RECT → none → esc()
      if (expr.includes("platform_offsets")) {                 // EXTRACT (check BEFORE HAS_FOLLOWER: both have "팔로워")
        const c = cards[i];
        return {
          status: "활성", library_id: c.libid, started_at: "2026. 2. 26.에 게재 시작함",
          advertiser: c.advertiser || c.libid, follower_raw: `팔로워 ${c.follower}명`,
          category: "건강/뷰티", page_id: c.page_id || null, platform_offsets: ["-387px -766px"], video_duration: null,
        };
      }
      if (expr.includes("팔로워") && expr.includes("followers?")) return true;  // HAS_FOLLOWER
      if (expr.includes("real fbcdn mp4")) {                   // VIDEO_SRC
        const u = cards[i] && cards[i].videoUrl;
        return u ? { full: u, key: u.split("?")[0] } : null;
      }
      return null;
    },
  };
  return { ctx, flags, collected };
}

const A = (id) => ({ full: `https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/${id}_n.jpg?oh=sig&oe=exp`, key: `https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/${id}_n.jpg` });

test("captureAndCollect: each ad's record carries ITS OWN detail (1:1 by construction, no mis-join)", async () => {
  const cards = [
    { cardAssets: [A("100_1")], modalAssets: [A("100_1")], libid: "AAA", advertiser: "X", follower: 10, page_id: "px" },
    { cardAssets: [A("200_2")], modalAssets: [A("200_2")], libid: "BBB", advertiser: "Y", follower: 20, page_id: "py" },
  ];
  const { ctx, collected } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  assert.equal(collected.length, 2);
  // ad X's record has X's detail; ad Y's has Y's — never swapped.
  const recX = collected.find((c) => c.imageKey.includes("100_1"));
  const recY = collected.find((c) => c.imageKey.includes("200_2"));
  assert.equal(recX.meta.advertiser_name, "X");
  assert.equal(recX.meta.follower_count, 10);
  assert.equal(recX.meta.detail_captured, true);
  assert.equal(recY.meta.advertiser_name, "Y");
  assert.equal(recY.meta.follower_count, 20);
  // the FULL signed url is passed for the fetch; the stripped key is the record id.
  assert.ok(recX.imageFull.includes("oh=sig"), "full signed url passed to fetch");
  assert.ok(!recX.imageKey.includes("?"), "imageKey is query-stripped");
});

test("captureAndCollect: a RESOLD creative (two ads share one asset) → two records, each its OWN detail", async () => {
  // Both ads' modal shows the SAME asset basename. Old design dropped it as a join collision; modal-driven
  // builds TWO independent records (each from its own modal pass) — each correct, no drop, no mis-join.
  const shared = A("555_5");
  const cards = [
    { cardAssets: [shared], modalAssets: [shared], libid: "P-AD", advertiser: "P", follower: 11, page_id: "pp" },
    { cardAssets: [shared], modalAssets: [shared], libid: "Q-AD", advertiser: "Q", follower: 22, page_id: "pq" },
  ];
  const { ctx, collected } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  // first ad collects the asset; the second is deduped by the harness in real runs (mock has no dedup), but the
  // KEY correctness property is: each collectCreative call carries the calling ad's own detail.
  assert.equal(collected[0].meta.advertiser_name, "P");
  assert.equal(collected[1].meta.advertiser_name, "Q");
  assert.notEqual(collected[0].meta.follower_count, collected[1].meta.follower_count);
});

test("captureAndCollect: an ad with multiple image renditions → ONE record (primary creative, no per-variant inflation)", async () => {
  // One ad surfacing several renditions (aspect-ratio variants / carousel slides) must NOT inflate into
  // multiple ad records — the corpus counts distinct ADS. Only the primary (first) creative is collected.
  const cards = [
    { cardAssets: [A("11_1"), A("11_2"), A("11_3")], modalAssets: [A("11_1"), A("11_2"), A("11_3")],
      libid: "CAR", advertiser: "Carousel", follower: 99, page_id: "pc" },
  ];
  const { ctx, collected } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  assert.equal(collected.length, 1, "one record per ad (renditions/variants not re-collected)");
  assert.ok(collected[0].imageKey.includes("11_1"), "the primary (first) creative is kept");
  assert.equal(collected[0].meta.advertiser_name, "Carousel");
  assert.equal(collected[0].meta.detail_captured, true);
});

test("captureAndCollect: modal-fail FALLBACK → collect the grid card img with no detail (coverage not worse)", async () => {
  const cards = [
    { cardAssets: [A("ok_1")], modalAssets: [A("ok_1")], libid: "OK", advertiser: "Good", follower: 5, page_id: "po" },
    { cardAssets: [A("fail_2")], modalFails: true, libid: "NO", advertiser: "Bad", follower: 0, page_id: "pn" },
  ];
  const { ctx, collected, flags } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  assert.equal(collected.length, 2, "both creatives collected (fallback for the failed modal)");
  const ok = collected.find((c) => c.imageKey.includes("ok_1"));
  const bad = collected.find((c) => c.imageKey.includes("fail_2"));
  assert.equal(ok.meta.detail_captured, true);
  // the failed-modal card is still collected, but WITHOUT detail (no advertiser_name, no detail_captured:true).
  assert.notEqual(bad.meta.detail_captured, true);
  assert.equal(bad.meta.advertiser_name, undefined);
  assert.ok(flags.some((f) => /1 fallback/.test(f)), `expected a fallback count flag, got ${JSON.stringify(flags)}`);
});

test("captureAndCollect: a video ad → ONE video-only record (videoKey, NO poster image); image ad → image-only", async () => {
  const mp4Full = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/AQOvideo.mp4?_nc_cat=1&oh=sig&oe=exp";
  const mp4 = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/AQOvideo.mp4";
  const cards = [
    { cardAssets: [A("vid_1")], modalAssets: [A("vid_1")], libid: "VID", advertiser: "VidAdv", follower: 50, page_id: "pv", videoUrl: mp4Full },
    { cardAssets: [A("img_2")], modalAssets: [A("img_2")], libid: "IMG", advertiser: "ImgAdv", follower: 60, page_id: "pi" },
  ];
  const { ctx, collected } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  const vid = collected.find((c) => c.videoKey);
  const img = collected.find((c) => c.imageKey && c.imageKey.includes("img_2"));
  // VIDEO ad → video-only: videoKey/videoFull carried, and NO poster image (imageKey absent) so the video's
  // first-frame never enters the image corpus the human reviews.
  assert.equal(vid.videoKey, mp4, "stripped <video>.src carried as videoKey");
  assert.equal(vid.videoFull, mp4Full, "full signed mp4 url carried for the fetch");
  assert.equal(vid.imageKey, undefined, "video ad emits NO poster image");
  assert.equal(vid.meta.advertiser_name, "VidAdv");
  // IMAGE ad → image-only: imageKey set, no video url.
  assert.ok(img.imageKey.includes("img_2"));
  assert.equal(img.videoKey, undefined);
});

test("captureAndCollect: prefers the MODAL's creative imgs over the grid card imgs when present", async () => {
  // grid card shows one src; the modal shows a DIFFERENT (full-res) src → the modal one is collected.
  const cards = [
    { cardAssets: [A("grid_1")], modalAssets: [A("modal_1")], libid: "M", advertiser: "ModalAdv", follower: 7, page_id: "pm" },
  ];
  const { ctx, collected } = makeCtx(cards);
  await flow.captureAndCollect(ctx, "q");
  assert.equal(collected.length, 1);
  assert.ok(collected[0].imageKey.includes("modal_1"), "modal creative img preferred over grid card img");
});

test("captureAndCollect: honors the global limit (limitReached) — stops collecting once reached", async () => {
  const cards = Array.from({ length: 5 }, (_, k) => ({
    cardAssets: [A(`c_${k}`)], modalAssets: [A(`c_${k}`)], libid: `L${k}`, advertiser: `Adv${k}`, follower: k, page_id: `p${k}`,
  }));
  const { ctx, collected } = makeCtx(cards, { cap: 3 });
  await flow.captureAndCollect(ctx, "q");
  assert.equal(collected.length, 3, "stops at the global limit");
});

test("captureAndCollect: IMAGE budget drives the loop — videos are incidental and don't consume it", async () => {
  // A page interleaving video and image ads. With imagesPerQuery=2 the loop must keep going PAST the videos
  // until it has 2 IMAGES — the videos it passes are collected (uncapped) but never count toward the budget.
  const mp4 = (id) => `https://video-icn2-1.xx.fbcdn.net/o1/v/t2/${id}.mp4?oh=s&oe=e`;
  const cards = [
    { cardAssets: [A("v1")], modalAssets: [A("v1")], libid: "V1", advertiser: "Va", follower: 1, page_id: "p1", videoUrl: mp4("v1") },
    { cardAssets: [A("i1")], modalAssets: [A("i1")], libid: "I1", advertiser: "Ia", follower: 2, page_id: "p2" },
    { cardAssets: [A("v2")], modalAssets: [A("v2")], libid: "V2", advertiser: "Vb", follower: 3, page_id: "p3", videoUrl: mp4("v2") },
    { cardAssets: [A("i2")], modalAssets: [A("i2")], libid: "I2", advertiser: "Ib", follower: 4, page_id: "p4" },
    { cardAssets: [A("i3")], modalAssets: [A("i3")], libid: "I3", advertiser: "Ic", follower: 5, page_id: "p5" },
  ];
  const { ctx, collected } = makeCtx(cards, { imagesPerQuery: 2 });
  await flow.captureAndCollect(ctx, "q");
  const imgs = collected.filter((c) => c.imageKey);
  const vids = collected.filter((c) => c.videoKey);
  assert.equal(imgs.length, 2, "stops at the 2-IMAGE budget");
  assert.equal(vids.length, 2, "both videos passed en route are collected (uncapped, not counted)");
  assert.ok(!collected.some((c) => c.imageKey && c.imageKey.includes("i3")), "the 3rd image is never reached — budget hit at the 2nd");
});
