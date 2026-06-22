import { defineFlow } from "../../shared/collect/define-flow.mjs";
import { normalizeDetail } from "./detail-normalize.mjs";

// Meta uses the public FILTER URL directly (the documented public-ad-transparency carve-out) — there is
// NO search-box/mouse interaction; the query is a URL parameter, and the assembled URL is still validated
// against the whitelisted public front-door by ad-collect-harness.goto → matchToolEntry. Per query `q`
// (q is RUNTIME input — never baked):
//   a. navigate   target: filter front-door + config params + q   action: ctx.goto (wait load + SPA settle)   → page | blocked → STOP
//   b. readCount  target: document.body innerText                 action: regex "<n> results"                 → coverage signal only
//   c. scroll     action: ctx.scroll ×5 (lazy-load creative images)                                            → DOM grows + creatives buffered
//   d. detail     action: per card open the detail modal (el.click) → DOM-text extract → CDP-click the
//                 광고주 정보 accordion → extract follower/category/page_id/platforms → normalizeDetail →
//                 build metaByKey indexed by the card's <img> dedup-key (== network creative url, query-stripped)
//   e. capture    action: ctx.drain({}, metaByKey) — harness saves buffered imgMatch/videoMatch responses and
//                 merges each card's detail into the matching creative by image-URL key (deterministic join)
//
// IMAGE↔DETAIL ASSOCIATION (decided LIVE, recon §9): opening a modal triggers NO fresh creative network
// response (buffer grows 0 — creatives load once during grid scroll, then cached), so per-card resetBuffer→
// drain (Approach A) captures nothing. Instead each card's <img>.src (query-stripped) EXACTLY equals a
// buffered network creative url (query-stripped) — a deterministic key. So detail is joined to the creative
// by that key inside drain(metaByKey), NOT by fragile network-order mapping. No order assumption, no mis-join.
export default defineFlow({
  name: "meta",
  source: "meta_ad_library",
  entrypoints: ["https://www.facebook.com/ads/library/"],
  acceptModes: ["keyword", "advertiser"],
  imgMatch: (u) => u.indexOf("t39.35426") > -1 && u.indexOf("scontent") > -1,   // fbcdn ad-creative image url
  // recon §4: mime-led (Meta videos are reliably mime=video/mp4), URL fallback (video- host + .mp4). NOT
  // imgMatch (images are scontent + t39.35426). NOTE: the real host has an infix region label
  // (`video-icn2-1.xx.fbcdn.net`), so the host charclass must allow `.` between `video-…` and `fbcdn.net`
  // (the brief's `video-[a-z0-9-]+\.fbcdn\.net` did NOT match recon §4's own URLs — corrected here, live §9).
  videoMatch: (u, mime = "") =>
    /^video\//i.test(mime) ||
    (/\.mp4(\?|$)/i.test(u) && /video-[a-z0-9.-]+\.fbcdn\.net/i.test(u)),
  // filter parameters as NAMED CONFIG (not literals in collect); `q` is always the runtime value.
  // No media_type ⇒ video ads are included (recon §0 front-door shows video without the param).
  // maxDetails bounds the per-card modal loop so the whole source stays under the harness' 180s hard timeout
  // (each card ≈ open + accordion CDP-click(~7s) + ESC). 6 proves the join across image+video cards comfortably.
  config: { active_status: "active", ad_type: "all", country: "KR", search_type: "keyword_unordered", maxScroll: 5, maxDetails: 6 },
  filterUrl(query) { return `https://www.facebook.com/ads/library/?${new URLSearchParams({ ...this.config, q: query })}`; },

  async collect(ctx) {                       // steps a–e per the FLOW header above
    for (const { query: q } of ctx.queries) {
      if (ctx.limitReached()) break;
      ctx.resetBuffer();
      if (!(await ctx.goto(this.filterUrl(q)))) { ctx.flag(`blocked: ${q}`); break; }
      // results-count coverage signal (KR ⊥ EN): EN "~5,700 results" / KR "결과 ~5,800개" (live §9)
      const body = await ctx.evalJs("document.body.innerText.slice(0,5000)");
      const m = body.match(/~?\s*([0-9,]+)\s*results/i) || body.match(/결과\s*~?\s*([0-9,]+)\s*개/);
      ctx.flag(`"${q}": ${m ? m[1] : "?"} results`);
      await ctx.scroll(this.config.maxScroll);

      // d. per-card detail capture → metaByKey (image dedup-key → normalized detail)
      const metaByKey = await this.captureDetails(ctx);
      const captured = Object.keys(metaByKey).length;
      ctx.flag(`"${q}": detail captured for ${captured} card-image(s)`);

      // e. drain: save buffered creatives, merge each card's detail by image-URL key
      await ctx.drain({}, metaByKey);
    }
  },

  // Open each ad's detail modal, extract the detail fields, and return { [imgDedupKey]: detailMeta }.
  // A card may carry several <img> (carousel) — every one of the card's image keys maps to the same detail.
  //
  // COLLISION SAFETY (live §9): the join key is dedupKey(image_url) = the query-stripped url. Two DIFFERENT
  // advertisers can resell the SAME agency creative (same path, different `?_nc_*` query) → same dedupKey.
  // Because drain keeps only the FIRST creative per key (seen.has) and a naive last-write map would keep only
  // the LAST detail, a collision could attach advertiser B's detail to advertiser A's surviving creative — the
  // exact mis-join the brief forbids ("mis-joined is worse than none"). So we treat a key touched by two
  // detail DIFFERENT ads (by library_id, else advertiser_name) as CONFLICTED: drop it from the map entirely
  // and flag it. A re-touch by the SAME ad (same library_id) is not a conflict. Net: a creative gets ITS OWN
  // correct detail or none — never another advertiser's.
  async captureDetails(ctx) {
    const out = {};
    const conflicted = new Set();   // keys seen with ≥2 distinct ads' details → never attach
    const identOf = (d) => (d && (d.library_id || d.advertiser_name)) || null;  // identity for conflict test
    const nTrig = await ctx.evalJs(`${TRIG}.length`);
    const limit = Math.min(nTrig, this.config.maxDetails);
    for (let i = 0; i < limit; i++) {
      try {
        // card image dedup-keys (query-stripped) BEFORE opening the modal (stable grid DOM)
        const imgKeys = await ctx.evalJs(CARD_IMG_KEYS(i));
        if (!Array.isArray(imgKeys) || !imgKeys.length) continue;

        // open the detail modal. recon §1 (re-verified live): a CDP click at the trigger's center did
        // NOT open it in headless (reflow / overlay), but the element's own activation DOES. el.click()
        // is a real user-gesture-equivalent element activation — NOT DOM value injection / synthetic submit.
        const opened = await ctx.evalJs(`(() => { const b=${TRIG}[${i}]; if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
        if (!opened) continue;
        await ctx.sleep(3200);
        if (!(await ctx.evalJs(`!!${DLG}`))) continue;  // modal didn't open → skip this card (no fabrication)
        // Reset page scroll to top so the modal renders consistently. Live §9: the 2nd+ modal opens with the
        // page scrolled down, which places the modal's lower accordion ~2100px below the fold where neither
        // scrollIntoView nor a clamped CDP click can reach it; opening from scrollTop=0 (as the 1st modal does)
        // keeps the accordion on-screen and clickable. The fixed-overlay modal stays put across this scroll.
        await ctx.evalJs("window.scrollTo(0,0)");
        await ctx.sleep(600);

        // expand the 광고주 정보 / About the advertiser accordion. recon §8b (re-verified live): el.click()
        // does NOT toggle it (innerText unchanged); a real CDP mouse click at its fresh center coords DOES.
        // The accordion's coords shift per modal, so re-read fresh coords each try and verify the expand
        // actually revealed the follower/ID block — retry once if not (the single fragile CDP step).
        for (let attempt = 0; attempt < 2; attempt++) {
          if (await ctx.evalJs(HAS_FOLLOWER)) break;     // already expanded
          const accRect = await ctx.evalJs(ACC_RECT);
          if (!accRect || typeof accRect.x !== "number") break;  // no accordion header → nothing to expand
          await ctx.clickAt(accRect.x, accRect.y);
        }

        const raw = await ctx.evalJs(EXTRACT);   // flat-line regex extraction (recon §2/§8)
        await this.closeModal(ctx);               // close (verify) BEFORE moving on — stale modals stack & break the next
        if (!raw) continue;
        const detail = normalizeDetail(raw);
        if (!detail.detail_captured) continue;    // nothing usable → don't attach an empty join
        for (const k of imgKeys) {
          if (conflicted.has(k)) continue;                 // already poisoned by an earlier collision
          const prev = out[k];
          if (prev && identOf(prev) !== identOf(detail)) {  // a DIFFERENT ad already claimed this key
            delete out[k];                                  // drop both → creative stays detail-less, not mis-joined
            conflicted.add(k);
            ctx.flag(`detail join-key collision: ${k} — conflicting ads, detail dropped`);
            continue;
          }
          out[k] = detail;                                  // free, or a re-touch by the same ad (not a conflict)
        }
      } catch {
        // a single card failing to open/extract must not abort the run — leave it detail-less and move on.
        try { await this.closeModal(ctx); } catch { /* best-effort close */ }
      }
    }
    return out;
  },

  // Close the detail modal and VERIFY it closed. Live §9: ESC alone stops closing the modal after a few
  // opens (stacking — unclosed modals accumulate, and the next card then matches a stale/tall dialog whose
  // accordion is off-screen). The modal's top-right Close control (recon §2) is the reliable closer; ESC is
  // the fallback. We confirm the dialog is gone before returning so modals never pile up.
  async closeModal(ctx) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!(await ctx.evalJs(`!!${DLG}`))) return true;      // already closed
      const closeRect = await ctx.evalJs(CLOSE_RECT);
      if (closeRect && typeof closeRect.x === "number") await ctx.clickAt(closeRect.x, closeRect.y);
      else await ctx.esc();
      if (!(await ctx.evalJs(`!!${DLG}`))) return true;
      await ctx.esc();                                        // fallback / second nudge
    }
    return !(await ctx.evalJs(`!!${DLG}`));
  },
});

// ---- in-page expressions (selectors/patterns are the recon-notes.md SOT; KR ⊥ EN) ----

// detail trigger: div[role=button] whose innerText is exactly the detail label (NOT the summary variant)
const TRIG = `[...document.querySelectorAll('div[role="button"]')].filter(e => /^(See ad details|광고 상세 정보 보기|상세정보)$/.test((e.innerText||'').trim()))`;

// the ad-detail dialog: a role=dialog whose text contains the *labelled* library id ("라이브러리 ID" / "Library ID")
// — anchoring on "ID" excludes the nav panel, which contains the bare word "광고 라이브러리" (recon §9).
const DLG = `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')]; return ds.map(d=>({d,t:d.innerText||''})).filter(o=>/Library ID|라이브러리 ID/i.test(o.t)).sort((a,b)=>b.t.length-a.t.length)[0]?.d; })()`;

// the i-th card's image dedup-keys (currentSrc/src, query-stripped) — walk up from the trigger to the
// nearest ancestor holding <img>/<video poster>. These keys join to the buffered network creative urls.
const CARD_IMG_KEYS = (i) => `(() => {
  const b=${TRIG}[${i}]; if(!b) return [];
  let p=b;
  for(let k=0;k<12 && p;k++){
    const srcs=[...p.querySelectorAll('img')].map(im=>im.currentSrc||im.src)
      .concat([...p.querySelectorAll('video')].map(v=>v.poster||v.currentSrc||v.src))
      .filter(Boolean).filter(s=>/t39\\.35426/.test(s) || /video-[a-z0-9.-]+\\.fbcdn\\.net/.test(s));
    if(srcs.length) return [...new Set(srcs.map(s=>s.split('?')[0]))];
    p=p.parentElement;
  }
  return [];
})()`;

// coords of the modal's top Close control (recon §2: a "Close"/"닫기" control sits at the dialog's top-right).
// Pick the highest (smallest top) visible "Close" element — always on-screen, the reliable closer.
const CLOSE_RECT = `(() => {
  const d=${DLG}; if(!d) return null;
  const els=[...d.querySelectorAll('*')].filter(e=>/^(Close|닫기)$/.test((e.innerText||'').trim()))
    .map(e=>({e,r:e.getBoundingClientRect()})).filter(o=>o.r.width>0 && o.r.height>0)
    .sort((a,b)=>a.r.top-b.r.top);
  if(!els.length) return null;
  const r=els[0].r;
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) };
})()`;

// true once the accordion is expanded (the follower/ID block is now in the dialog text) — the verify gate
// that decides whether the accordion CDP-click must be retried.
const HAS_FOLLOWER = `(() => { const d=${DLG}; if(!d) return false; return /팔로워\\s*[0-9]|[0-9][0-9.,]*[KMB]?\\s*followers?/i.test(d.innerText||''); })()`;

// Fresh center coords for a real CDP click on the 광고주 정보 / About the advertiser accordion header.
// recon §8b + live §9: the header must be CDP-clicked (el.click doesn't toggle). LOAD-BEARING:
// scrollIntoView({block:'START'}), NOT 'center'. Live finding (§9): at a tall viewport (innerH≈1334)
// 'center' lands the header near y≈667 and the CDP click — though it hit-tests to the right element —
// silently does NOT toggle the accordion (a headless lower-viewport click quirk); 'start' lands it near
// the top (y≈150) where the click reliably toggles (proven across cards 0..3). The retry+verify loop
// (HAS_FOLLOWER gate) still guards against a missed toggle.
const ACC_RECT = `(() => {
  const d=${DLG}; if(!d) return null;
  const cand=[...d.querySelectorAll('*')].filter(e=>{
    const t=(e.textContent||'').trim();
    if(!/^(광고주 정보|About the advertiser|Advertiser info)$/i.test(t)) return false;
    return ![...e.children].some(ch=>/광고주 정보|About the advertiser|Advertiser info/i.test(ch.textContent||''));
  });
  if(!cand.length) return null;
  let click=cand[0];
  for(let i=0;i<4 && click;i++){ if(click.getAttribute('role')==='button'||click.getAttribute('aria-expanded')!=null) break; click=click.parentElement; }
  const t=click||cand[0];
  t.scrollIntoView({block:'start'});
  const r=t.getBoundingClientRect();
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top + r.height/2) };
})()`;

// flat-line regex extraction of the detail-modal fields (recon §2/§8). Returns the raw shape that
// normalizeDetail(raw) consumes: { status, library_id, started_at, advertiser, follower_raw, category,
// page_id, platform_offsets, video_duration }. KR ⊥ EN label variants both handled.
const EXTRACT = `(() => {
  const d=${DLG}; if(!d) return null;
  const t=d.innerText||'';
  const lines=t.split('\\n').map(s=>s.trim()).filter(Boolean);
  const library_id=(t.match(/(?:Library ID|라이브러리 ID):\\s*([0-9]+)/i)||[])[1]||null;
  const started_at=(t.match(/[0-9]{4}\\.\\s*[0-9]{1,2}\\.\\s*[0-9]{1,2}\\.?에 게재 시작함/)||t.match(/(?:Started running on|게재 시작)[^\\n]*/i)||[])[0]||null;
  const status=(lines.find(l=>/^(활성|비활성|Active|Inactive)$/.test(l)))||null;
  const si=lines.findIndex(l=>/^(광고|Sponsored)$/.test(l));
  const advertiser=si>0?lines[si-1]:null;
  const follower_raw=(t.match(/팔로워\\s*([0-9][0-9.,]*\\s*(?:천|만|억)?\\s*명?)/)||t.match(/([0-9][0-9.,]*[KMB]?)\\s*followers?/i)||[])[0]||null;
  // page_id = an "ID: <n>" that is NOT the "라이브러리 ID/Library ID" line (which == library_id). recon §8b.
  let page_id=null;
  const idMatches=[...t.matchAll(/(?:^|[^가-힣A-Za-z])ID:\\s*([0-9]+)/g)].map(m=>m[1]);
  for(const id of idMatches){ if(id!==library_id){ page_id=id; break; } }
  // category = the line after the 팔로워/followers line (recon §8b: 건강/뷰티)
  let category=null;
  const fi=lines.findIndex(l=>/팔로워|followers/i.test(l));
  if(fi>=0 && lines[fi+1] && !/추가 정보|More info|About/i.test(lines[fi+1])) category=lines[fi+1];
  const video_duration=(t.match(/\\d+:\\d{2}\\s*\\/\\s*\\d+:\\d{2}/)||[])[0]||null;
  // platforms: each icon under 플랫폼/Platforms is a sprite with a distinct mask-position (recon §8c).
  const platform_offsets=(() => {
    const lab=[...d.querySelectorAll('*')].find(e=>/^(Platforms|플랫폼)$/.test((e.innerText||'').trim()));
    if(!lab) return [];
    const scopes=[lab.nextElementSibling, lab.parentElement].filter(Boolean);
    const seen=new Set(); const out=[];
    for(const sc of scopes) for(const n of sc.querySelectorAll('*')){
      const cs=getComputedStyle(n);
      const mask=cs.maskImage||cs.webkitMaskImage||'none';
      if(mask==='none') continue;
      const pos=(cs.maskPosition||cs.webkitMaskPosition||'').trim();
      if(!pos||seen.has(pos)) continue;
      seen.add(pos); out.push(pos);
    }
    return out;
  })();
  return { status, library_id, started_at, advertiser, follower_raw, category, page_id, platform_offsets, video_duration };
})()`;
