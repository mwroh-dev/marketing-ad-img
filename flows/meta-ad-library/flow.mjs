import { defineFlow } from "../../shared/collect/define-flow.mjs";
import { normalizeDetail } from "./detail-normalize.mjs";

// Meta uses the public FILTER URL directly (the documented public-ad-transparency carve-out) — there is
// NO search-box/mouse interaction; the query is a URL parameter, and the assembled URL is still validated
// against the whitelisted public front-door by ad-collect-harness.goto → matchToolEntry. Per query `q`
// (q is RUNTIME input — never baked):
//   a. navigate   target: filter front-door + config params + q   action: ctx.goto (wait load + SPA settle)   → page | blocked → STOP
//   b. readCount  target: document.body innerText                 action: regex "<n> results"                 → coverage signal only
//   c. scroll     action: ctx.scroll ×5 (lazy-load creative images)                                            → DOM grows
//   d. collect    action: MODAL-DRIVEN — per ad card: open the detail modal (el.click) → DOM-text extract +
//                 CDP-click the 광고주 정보 accordion → follower/category/page_id/platforms → read this ad's
//                 creative image url(s) (card <img> + modal img; carousel → multiple) + modal <video>.src →
//                 ctx.collectCreative per asset: FETCH the asset by its full signed url, save images/ad-N.jpg
//                 (+ videos/ad-N.mp4 for video ads), build ONE record with THIS ad's detail attached.
//
// MODAL-DRIVEN REARCHITECTURE (recon §11/§12): the OLD design ran two passes (grid scroll buffered creative
// NETWORK responses; a separate modal pass built a metaByKey and drain() joined the two by image-url key).
// That left ~3/24 creatives detail-less because the buffered-creative set and the opened-modal set did not
// perfectly overlap (CDN size-variant url mismatches + occasional modal-open misses). The fix UNIFIES the
// passes: collection is DRIVEN from the modal pass. For each ad we open its modal, extract its detail, AND
// fetch that ad's creative asset(s) DIRECTLY by the full signed fbcdn url (proven token-authed: a bare Node
// GET returns the complete jpg/mp4 — recon §12a images, §11a video). Each collected creative is therefore
// 1:1 with its detail BY CONSTRUCTION — no join, no mis-join (two ads reselling one asset = two records, each
// from its own modal pass with its own detail). The Network buffer/drain path is RETIRED for Meta (it stays
// in the harness for Google, which still uses scroll→buffer→drain). Modal-open/extract failure FALLS BACK to
// collecting the card's grid <img> with detail_captured:false, so creative coverage is never worse than before.
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
  // MODAL-DRIVEN (rearch): the per-card modal loop is UNCAPPED (covers every detail trigger present) and, for
  // each ad, both extracts detail AND fetches that ad's creative asset(s) — so every collected creative is 1:1
  // with its detail by construction. Per-card cost stays low via EVENT-DRIVEN polls (modal-open polls !!DLG
  // ≤5s; accordion-expand polls HAS_FOLLOWER after a QUICK clickAt) plus the per-ad asset fetch(es) (~0.3-0.5s
  // each, recon §11/§12). The harness hard timeout is 360s — a real graceful bound for the deep full pass.
  config: { active_status: "active", ad_type: "all", country: "KR", search_type: "keyword_unordered", maxScroll: 5 },
  filterUrl(query) { return `https://www.facebook.com/ads/library/?${new URLSearchParams({ ...this.config, q: query })}`; },

  async collect(ctx) {                       // steps a–d per the FLOW header above
    for (const { query: q } of ctx.queries) {
      if (ctx.limitReached()) break;
      ctx.resetBuffer();
      if (!(await ctx.goto(this.filterUrl(q)))) { ctx.flag(`blocked: ${q}`); break; }
      // results-count coverage signal (KR ⊥ EN): EN "~5,700 results" / KR "결과 약 5,800개" (live §9).
      // KR renders an optional 약("about") infix → make it optional so the count isn't dropped as "?".
      const body = await ctx.evalJs("document.body.innerText.slice(0,5000)");
      const m = body.match(/~?\s*([0-9,]+)\s*results/i) || body.match(/결과\s*(?:약\s*)?~?\s*([0-9,]+)\s*개/);
      ctx.flag(`"${q}": ${m ? m[1] : "?"} results`);
      // d. IMAGE-DRIVEN scroll+collect for this keyword (no fixed up-front scroll — the loop scrolls as needed).
      await this.captureAndCollect(ctx, q);
    }
  },

  // IMAGE-DRIVEN collection for ONE keyword: the budget is IMAGES (videos collected incidentally, uncapped).
  // Interleaves scroll-load-more with per-card collection so the keyword keeps yielding images even when video
  // ads dominate. Stops at imagesPerQuery images, the global target (ctx.limitReached), or exhaustion (2 scrolls
  // with no new cards).
  async captureAndCollect(ctx, q) {
    const perQueryImages = ctx.imagesPerQuery || Infinity;
    let withDetail = 0, fallback = 0, total = 0, images = 0, videos = 0;
    let i = 0;        // next detail-trigger index to process
    let stale = 0;    // consecutive scrolls that loaded no new triggers
    while (images < perQueryImages && !ctx.limitReached()) {
      const nTrig = await ctx.evalJs(`${TRIG}.length`);
      if (i >= nTrig) {                                   // need more cards → scroll to load more
        await ctx.scroll(2);
        const after = await ctx.evalJs(`${TRIG}.length`);
        if (after <= nTrig) { if (++stale >= 2) break; }  // exhausted: no new cards after 2 scrolls
        else stale = 0;
        continue;
      }
      const r = await this.collectOneCard(ctx, i);
      i++;
      if (r.collected) { total++; if (r.isVideo) videos++; else images++; if (r.detail) withDetail++; else fallback++; }
    }
    ctx.flag(`"${q}": collected ${total} (${images} img, ${videos} video) — ${withDetail} with detail, ${fallback} fallback`);
  },

  // Process ONE ad: open its modal, extract detail + read the <video>.src and creative img(s), close, then
  // collect EXACTLY ONE creative — VIDEO ad → one video record (no poster in images/); IMAGE ad → one
  // representative image (modal preferred, card fallback; renditions not re-collected). Modal/extract failure →
  // grid card img, detail false. Returns { collected, isVideo, detail } so the keyword loop counts img vs video.
  async collectOneCard(ctx, i) {
    // card image assets (full signed + stripped key) read BEFORE opening the modal — the modal-fail FALLBACK.
    let cardAssets = [];
    try { cardAssets = await ctx.evalJs(CARD_IMG_ASSETS(i)); } catch { cardAssets = []; }
    if (!Array.isArray(cardAssets) || !cardAssets.length) return { collected: false };

    let detail = null, video = null, modalAssets = [];
    try {
      const opened = await ctx.evalJs(`(() => { const b=${TRIG}[${i}]; if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
      if (opened && (await ctx.pollUntil(`!!${DLG}`, { timeoutMs: 5000, intervalMs: 300 }))) {
        await ctx.evalJs("window.scrollTo(0,0)");
        await ctx.sleep(600);
        for (let attempt = 0; attempt < 2; attempt++) {
          if (await ctx.evalJs(HAS_FOLLOWER)) break;
          const accRect = await ctx.evalJs(ACC_RECT);
          if (!accRect || typeof accRect.x !== "number") break;
          await ctx.clickAt(accRect.x, accRect.y, 200);
          if (await ctx.pollUntil(HAS_FOLLOWER, { timeoutMs: 4000, intervalMs: 300 })) break;
        }
        const raw = await ctx.evalJs(EXTRACT);
        video = await ctx.evalJs(VIDEO_SRC);          // { full, key } | null
        try { modalAssets = await ctx.evalJs(MODAL_IMG_ASSETS); } catch { modalAssets = []; }
        if (raw) { const d = normalizeDetail(raw); if (d.detail_captured) detail = d; }
      }
    } catch { /* fall through to fallback collection */ }
    try { await this.closeModal(ctx); } catch { /* best-effort */ }

    const meta = detail ? { ...detail } : {};
    if (video && video.key) {
      const res = await ctx.collectCreative({ videoKey: video.key, videoFull: video.full, meta });
      return { collected: res.collected, isVideo: true, detail: !!detail };
    }
    const assets = (Array.isArray(modalAssets) && modalAssets.length) ? modalAssets : cardAssets;
    const primary = assets.find((a) => a && a.key);   // the ad's primary creative (modal preferred, card fallback)
    if (primary) {
      const res = await ctx.collectCreative({ imageKey: primary.key, imageFull: primary.full, meta });
      return { collected: res.collected, isVideo: false, detail: !!detail };
    }
    return { collected: false };
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

// IS_CREATIVE_IMG: a t39.35426 <img> is a real ad CREATIVE, not the advertiser AVATAR/logo. Live probe (recon
// §12b): the modal/card always renders the page avatar as a tiny `stp=dst-jpg_s60x60` thumbnail (naturalWidth
// 60, ~1KB) ALONGSIDE the real creatives (`s600x600`, naturalWidth 480–600, 30–50KB). Selecting the avatar as
// a creative produced url-only "too small" records (no bytes). We reject it by intrinsic size — real creatives
// are ≥200px on a side; avatars are ≤60 — with a backstop on the small `stp` size token. naturalWidth is the
// loaded intrinsic size (reliable once the modal has rendered); fall back to the size token if not yet loaded.
const IS_CREATIVE_IMG = `(im => {
  const src = im.currentSrc || im.src || '';
  if(!/t39\\.35426/.test(src)) return false;
  const nw = im.naturalWidth || 0, nh = im.naturalHeight || 0;
  if(nw && nh) return nw >= 200 && nh >= 200;                 // intrinsic size known → trust it
  const m = src.match(/[?&]stp=[^&]*?s(\\d+)x(\\d+)/);          // not loaded → size token backstop
  if(m) return (+m[1]) >= 200 && (+m[2]) >= 200;
  return true;                                                 // no size signal at all → keep (don't silently drop)
})`;

// the i-th card's creative image assets — { full (signed, for the fetch), key (query-stripped, the stable
// dedup/join id stored in image_url) } — walk up from the trigger to the nearest ancestor holding
// <img>/<video poster>. MODAL-DRIVEN: `full` is fetched directly (recon §12); `key` is the record id. Only
// real ad-CREATIVE images (t39.35426, avatar filtered by IS_CREATIVE_IMG) / video posters are kept; deduped
// on `key`. (a real carousel → several distinct creative entries; repeated same-creative <img> → one entry)
const CARD_IMG_ASSETS = (i) => `(() => {
  const isCreative=${IS_CREATIVE_IMG};
  const b=${TRIG}[${i}]; if(!b) return [];
  let p=b;
  for(let k=0;k<12 && p;k++){
    const imgs=[...p.querySelectorAll('img')].filter(isCreative).map(im=>im.currentSrc||im.src);
    const posters=[...p.querySelectorAll('video')].map(v=>v.poster||v.currentSrc||v.src)
      .filter(Boolean).filter(s=>/t39\\.35426/.test(s) || /video-[a-z0-9.-]+\\.fbcdn\\.net/.test(s));
    const srcs=imgs.concat(posters);
    if(srcs.length){
      const seen=new Set(); const out=[];
      for(const s of srcs){ const key=s.split('?')[0]; if(seen.has(key)) continue; seen.add(key); out.push({full:s,key}); }
      return out;
    }
    p=p.parentElement;
  }
  return [];
})()`;

// the OPEN modal's own creative image assets — { full, key } — the ad's actual creative as shown in the modal
// (preferred over the grid card img when present; a real carousel modal shows several). t39.35426 + avatar
// filtered by IS_CREATIVE_IMG + per-key dedup. A video ad's modal poster <img> is kept (the video record's
// poster). If the avatar filter leaves nothing (e.g. all imgs not-yet-loaded), fall back to the unfiltered set
// so a creative is never dropped entirely — the harness size floor still rejects a tiny body url-only.
const MODAL_IMG_ASSETS = `(() => {
  const isCreative=${IS_CREATIVE_IMG};
  const d=${DLG}; if(!d) return [];
  const imgEls=[...d.querySelectorAll('img')];
  let imgs=imgEls.filter(isCreative).map(im=>im.currentSrc||im.src);
  if(!imgs.length) imgs=imgEls.map(im=>im.currentSrc||im.src).filter(s=>/t39\\.35426/.test(s) && !/s60x60/.test(s));  // fallback: don't drop all, but still exclude the s60x60 advertiser avatar
  const posters=[...d.querySelectorAll('video')].map(v=>v.poster||'').filter(Boolean).filter(s=>/t39\\.35426/.test(s));
  const srcs=imgs.concat(posters).filter(Boolean);
  const seen=new Set(); const out=[];
  for(const s of srcs){ const key=s.split('?')[0]; if(seen.has(key)) continue; seen.add(key); out.push({full:s,key}); }
  return out;
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

// The modal <video>.src — the .mp4 URL, already in the DOM the moment the modal opens (recon §10a:
// readyState 4, paused). A PURE READ (not DOM-value injection / synthetic submit / URL assembly). The
// element holds the url on `.src`/`.currentSrc` directly (no <source> child this run, but kept as fallback).
// Returns BOTH forms (recon §11b): `full` = the COMPLETE signed url (the `?_nc_*…oh=…oe=` query is the
// fbcdn auth — required to GET the bytes; stripping it 403s) for drain to fetch; `key` = query-stripped,
// the stable dedup/join identifier stored in the record. Guarded against the poster jpg (videoMatch host).
const VIDEO_SRC = `(() => {
  const d=${DLG}; if(!d) return null;
  const v=d.querySelector('video'); if(!v) return null;
  const src=v.src || v.currentSrc || (v.querySelector('source') && (v.querySelector('source').src || v.querySelector('source').getAttribute('src'))) || '';
  if(!/video-[a-z0-9.-]+\\.fbcdn\\.net/.test(src) || !/\\.mp4(\\?|$)/.test(src)) return null;  // must be a real fbcdn mp4
  return { full: src, key: src.split('?')[0] };
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
