import test from "node:test";
import assert from "node:assert/strict";
import flow from "./flow.mjs";

// Smoke for the collision-safe detail↔creative join in captureDetails (live §9). The join key is
// dedupKey(image_url) (query-stripped), so two DIFFERENT advertisers reselling the same agency creative can
// collide on one key. captureDetails must DROP a key claimed by two distinct ads (→ creative gets no detail,
// not a wrong one) while keeping clean keys. We drive captureDetails with a scripted fake ctx (no browser).

// Build a fake ctx that scripts a sequence of cards. Each card = { keys:[...], libid, advertiser, follower }.
// The fake answers each in-page expression by matching on a recognizable substring of the expression, and
// models dialog open/close so flow.closeModal (which polls !!DLG) terminates.
function makeCtx(cards) {
  let i = -1;                 // current card index (advanced when CARD_IMG_KEYS([n]) is read)
  let dialogOpen = false;     // toggled open on the trigger click, closed on esc/clickAt(close)
  const flags = [];
  const ctx = {
    flag: (s) => flags.push(s),
    sleep: async () => {},
    // clickAt now takes an optional postWaitMs (meta accordion passes a short value; google keeps the
    // default). The mock ignores it. A click on the Close control still closes the modal.
    clickAt: async (_x, _y, _postWaitMs) => { dialogOpen = false; },
    esc: async () => { dialogOpen = false; },
    // pollUntil mirrors the real harness primitive: evaluate the in-page boolean expr and return its truth.
    // Synchronous mocks resolve immediately, so a single eval models "polled until true (or false on timeout)".
    pollUntil: async (expr) => { try { return !!(await ctx.evalJs(expr)); } catch { return false; } },
    async evalJs(expr) {
      if (/\.length\s*$/.test(expr) && expr.includes('role="button"')) return cards.length;   // trigger count
      if (expr.includes("currentSrc||im.src")) {     // CARD_IMG_KEYS(i) — advance the cursor
        const m = expr.match(/\]\[(\d+)\]/);
        i = m ? Number(m[1]) : i + 1;
        return cards[i] ? cards[i].keys : [];
      }
      if (expr.includes("b.click()")) { dialogOpen = true; return true; }   // open the modal
      if (expr.includes("scrollTo(0,0)")) return null;
      if (expr.trim().startsWith("!!(")) return dialogOpen;                  // !!DLG presence check
      if (expr.includes("Close|닫기")) return null;                          // CLOSE_RECT → none → closeModal uses esc()
      if (expr.includes("platform_offsets")) {                              // EXTRACT → this card's raw detail (check BEFORE HAS_FOLLOWER: both contain "팔로워")
        const card = cards[i];
        return {
          status: "활성", library_id: card.libid, started_at: "2026. 2. 26.에 게재 시작함",
          advertiser: card.advertiser || card.libid, follower_raw: `팔로워 ${card.follower}명`,
          category: "건강/뷰티", page_id: card.page_id || null, platform_offsets: ["-387px -766px"], video_duration: null,
        };
      }
      if (expr.includes("팔로워") && expr.includes("followers?")) return true; // HAS_FOLLOWER → skip accordion loop
      // VIDEO_SRC read: real expr returns { full, key } (signed url + stripped id), or null for non-video.
      if (expr.includes("real fbcdn mp4")) {
        const u = cards[i] && cards[i].videoUrl;
        return u ? { full: u, key: u.split("?")[0] } : null;
      }
      return null;
    },
  };
  return { ctx, flags };
}

test("captureDetails: dedupKey collision between two distinct advertisers drops the key (+flag), keeps clean keys", async () => {
  // Card 0: advertiser X on shared key K1.  Card 1: advertiser Y on the SAME key K1 (collision).
  // Card 2: advertiser Z on its own key K2 (clean).  Card 3: advertiser X again, key K1 — already conflicted.
  const cards = [
    { keys: ["K1"], libid: "AAA", advertiser: "X", follower: 10, page_id: "px" },
    { keys: ["K1"], libid: "BBB", advertiser: "Y", follower: 20, page_id: "py" },
    { keys: ["K2"], libid: "CCC", advertiser: "Z", follower: 30, page_id: "pz" },
    { keys: ["K1"], libid: "AAA", advertiser: "X", follower: 10, page_id: "px" },
  ];
  const { ctx, flags } = makeCtx(cards);
  const { metaByKey: out } = await flow.captureDetails(ctx);

  // K1 must NOT be present (conflicted) — neither X's nor Y's detail attached.
  assert.equal(out.K1, undefined, "collided key K1 must be dropped, not last-write-wins");
  // K2 keeps its own correct detail.
  assert.ok(out.K2, "clean key K2 should retain detail");
  assert.equal(out.K2.advertiser_name, "Z");
  assert.equal(out.K2.follower_count, 30);
  // a collision flag was raised for K1.
  assert.ok(flags.some((f) => /join-key collision: K1/.test(f)), `expected a K1 collision flag, got: ${JSON.stringify(flags)}`);
});

test("captureDetails: a video ad's modal <video>.src is carried into metaByKey as video_url (audit I3)", async () => {
  // A video ad: VIDEO_SRC returns {full,key}; an image ad: VIDEO_SRC returns null.
  // The mock signs the url with a query (the makeCtx mock derives key = full.split('?')[0]).
  const mp4Full = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/AQOvideo.mp4?_nc_cat=1&oh=sig&oe=exp";
  const mp4 = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/AQOvideo.mp4";
  const cards = [
    { keys: ["VK"], libid: "VID", advertiser: "VidAdv", follower: 50, page_id: "pv", videoUrl: mp4Full },
    { keys: ["IK"], libid: "IMG", advertiser: "ImgAdv", follower: 60, page_id: "pi" },  // no videoUrl
  ];
  const { ctx } = makeCtx(cards);
  const { metaByKey: out } = await flow.captureDetails(ctx);
  // video card: detail carries the STRIPPED video_url (stable id) + the FULL signed url for drain to fetch.
  assert.ok(out.VK, "video card detail should be present");
  assert.equal(out.VK.video_url, mp4, "stripped <video>.src must be carried as the stable video_url");
  assert.equal(out.VK.video_url_full, mp4Full, "the FULL signed url must be carried for drain to download");
  assert.equal(out.VK.advertiser_name, "VidAdv");
  // image card: neither video field leaks in
  assert.ok(out.IK, "image card detail should be present");
  assert.equal(out.IK.video_url, undefined, "non-video card must NOT get a video_url");
  assert.equal(out.IK.video_url_full, undefined, "non-video card must NOT get a video_url_full");
});

test("captureDetails: same advertiser re-touching one key is NOT a conflict (carousel / repeat)", async () => {
  const cards = [
    { keys: ["KX"], libid: "SAME", advertiser: "OneAdv", follower: 7, page_id: "p1" },
    { keys: ["KX"], libid: "SAME", advertiser: "OneAdv", follower: 7, page_id: "p1" },
  ];
  const { ctx, flags } = makeCtx(cards);
  const { metaByKey: out } = await flow.captureDetails(ctx);
  assert.ok(out.KX, "same-ad re-touch must keep the detail");
  assert.equal(out.KX.advertiser_name, "OneAdv");
  assert.ok(!flags.some((f) => /collision/.test(f)), "no collision flag for same-ad re-touch");
});

test("captureDetails: metaByAsset indexes fbcdn asset-id; unique → fallback-able, conflicted → dropped", async () => {
  // Card A: advertiser P, card key is one SIZE VARIANT of an asset. Card B: advertiser Q, a DIFFERENT asset.
  // Card C: advertiser P AGAIN reselling the SAME asset as a third party would (different libid) → asset-id
  // conflict for A's asset. We assert metaByAsset keeps B's unique asset, drops the conflicted one.
  const A = "https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/100_200_300_n.jpg";   // asset 100_200_300
  const B = "https://scontent-icn3-1.xx.fbcdn.net/v/t39.35426-6/400_500_600_n.jpg";   // asset 400_500_600
  const Cvariant = "https://scontent-icn5-9.xx.fbcdn.net/v/t39.35426-6/100_200_300_n.jpg"; // SAME asset as A, diff host
  const cards = [
    { keys: [A], libid: "P-AD", advertiser: "P", follower: 11, page_id: "pp" },
    { keys: [B], libid: "Q-AD", advertiser: "Q", follower: 22, page_id: "pq" },
    { keys: [Cvariant], libid: "R-AD", advertiser: "R", follower: 33, page_id: "pr" },  // different ad, same asset
  ];
  const { ctx, flags } = makeCtx(cards);
  const { metaByAsset } = await flow.captureDetails(ctx);
  // B's asset is unique → present and usable as a fallback.
  assert.ok(metaByAsset["400_500_600"], "unique asset-id retained for fallback");
  assert.equal(metaByAsset["400_500_600"].advertiser_name, "Q");
  // A's asset claimed by two DIFFERENT ads (P-AD and R-AD) → conflicted → dropped, with a flag.
  assert.equal(metaByAsset["100_200_300"], undefined, "asset-id claimed by two ads must be dropped");
  assert.ok(flags.some((f) => /asset-id collision: 100_200_300/.test(f)), `expected asset-id collision flag, got: ${JSON.stringify(flags)}`);
});

test("captureDetails: same ad under two fbcdn SIZE VARIANTS is NOT an asset-id conflict (real variant case)", async () => {
  // The live gap: ONE ad's creative buffered under a CDN size variant. Same libid, different host/path variant
  // of the SAME asset basename → must NOT conflict; the asset-id stays usable for the drain fallback.
  const v1 = "https://scontent-icn2-1.xx.fbcdn.net/v/t39.35426-6/777_888_999_n.jpg";
  const v2 = "https://scontent-a.xx.fbcdn.net/v/t39.35426-6/777_888_999_n.jpg";  // same asset, variant host
  const cards = [
    { keys: [v1], libid: "ONE", advertiser: "OneAdv", follower: 5, page_id: "p1" },
    { keys: [v2], libid: "ONE", advertiser: "OneAdv", follower: 5, page_id: "p1" },
  ];
  const { ctx, flags } = makeCtx(cards);
  const { metaByAsset } = await flow.captureDetails(ctx);
  assert.ok(metaByAsset["777_888_999"], "same-ad variant keeps the asset-id usable");
  assert.equal(metaByAsset["777_888_999"].advertiser_name, "OneAdv");
  assert.ok(!flags.some((f) => /asset-id collision/.test(f)), "same-ad variant must not flag a conflict");
});
