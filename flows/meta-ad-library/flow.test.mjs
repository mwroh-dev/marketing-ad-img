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
    clickAt: async () => { dialogOpen = false; },   // a click on the Close control closes the modal
    esc: async () => { dialogOpen = false; },
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
      if (expr.includes("real fbcdn mp4")) return cards[i] ? (cards[i].videoUrl || null) : null; // VIDEO_SRC read
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
  const out = await flow.captureDetails(ctx);

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
  // A video ad: VIDEO_SRC returns the modal's mp4 URL; an image ad: VIDEO_SRC returns null.
  const mp4 = "https://video-icn2-1.xx.fbcdn.net/o1/v/t2/f2/m86/AQOvideo.mp4";
  const cards = [
    { keys: ["VK"], libid: "VID", advertiser: "VidAdv", follower: 50, page_id: "pv", videoUrl: mp4 },
    { keys: ["IK"], libid: "IMG", advertiser: "ImgAdv", follower: 60, page_id: "pi" },  // no videoUrl
  ];
  const { ctx } = makeCtx(cards);
  const out = await flow.captureDetails(ctx);
  // video card: detail carries video_url (drain/buildCreativeRecord then turns this into subtype:"video")
  assert.ok(out.VK, "video card detail should be present");
  assert.equal(out.VK.video_url, mp4, "modal <video>.src must be carried as video_url");
  assert.equal(out.VK.advertiser_name, "VidAdv");
  // image card: no video_url leaks in
  assert.ok(out.IK, "image card detail should be present");
  assert.equal(out.IK.video_url, undefined, "non-video card must NOT get a video_url");
});

test("captureDetails: same advertiser re-touching one key is NOT a conflict (carousel / repeat)", async () => {
  const cards = [
    { keys: ["KX"], libid: "SAME", advertiser: "OneAdv", follower: 7, page_id: "p1" },
    { keys: ["KX"], libid: "SAME", advertiser: "OneAdv", follower: 7, page_id: "p1" },
  ];
  const { ctx, flags } = makeCtx(cards);
  const out = await flow.captureDetails(ctx);
  assert.ok(out.KX, "same-ad re-touch must keep the detail");
  assert.equal(out.KX.advertiser_name, "OneAdv");
  assert.ok(!flags.some((f) => /collision/.test(f)), "no collision flag for same-ad re-touch");
});
