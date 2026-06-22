// CONSOLIDATED FOLLOW-UP RECON (Task 1 amendment) — KR locale. Opens the "광고 상세 정보" modal,
// expands the "광고주 정보" accordion (REAL CDP click — JS .click() on the wrapper does NOT toggle),
// extracts follower count + page category/ID, and maps platform sprite mask-positions.
// Throwaway. Non-intrusive headless; every CDP step timeout-bounded; in-page scrollBy only.
// Usage: node flows/meta-ad-library/_recon_followup.mjs [kw]
import { acquirePort } from "../../shared/collect/acquire-port.mjs";
import { launchChrome } from "../../shared/collect/launch-chrome.mjs";
import { connect } from "../../shared/collect/lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";

const KW = process.argv[2] || "비타민";
const FILTER_URL = `https://www.facebook.com/ads/library/?${new URLSearchParams({
  active_status: "active", ad_type: "all", country: "KR", search_type: "keyword_unordered", q: KW })}`;
const OUT = "/tmp/gai-meta-recon-out"; mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bound = (p, ms, l) => Promise.race([p, sleep(ms).then(() => { throw new Error(`TIMEOUT ${l}`); })]);
const log = (...a) => console.error("[fu]", ...a);
async function ev(c, e) {
  const { result, exceptionDetails } = await bound(c.Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true }), 15000, "eval");
  if (exceptionDetails) throw new Error(exceptionDetails.text || "eval err");
  return result.value;
}
const MATCH = `[...document.querySelectorAll('div[role="button"]')].filter(e => /^(See ad details|광고 상세 정보 보기|상세정보)$/.test((e.innerText||'').trim()))`;
const DLG = `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')]; return ds.map(d=>({d,t:d.innerText||''})).filter(o=>/Library ID|라이브러리/i.test(o.t)).sort((a,b)=>b.t.length-a.t.length)[0]?.d; })()`;

// returns {leaf rect} for the 광고주 정보 / About the advertiser header (to CDP-click)
const ACC_RECT = `(() => {
  const d=${DLG}; if(!d) return null;
  const cand=[...d.querySelectorAll('*')].filter(e=>{
    const t=(e.textContent||'').trim();
    if(!/^(광고주 정보|About the advertiser|Advertiser info)$/i.test(t)) return false;
    return ![...e.children].some(ch=>/광고주 정보|About the advertiser|Advertiser info/i.test(ch.textContent||''));
  });
  if(!cand.length) return null;
  const leaf=cand[0]; let click=leaf;
  for(let i=0;i<4 && click;i++){ if(click.getAttribute('role')==='button'||click.getAttribute('aria-expanded')!=null) break; click=click.parentElement; }
  const t=click||leaf; t.scrollIntoView({block:'center'});
  const r=t.getBoundingClientRect();
  return { x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2) };
})()`;

const PLATFORMS = `(() => {
  const d=${DLG}; if(!d) return null;
  const lab=[...d.querySelectorAll('*')].find(e=>/^(Platforms|플랫폼)$/.test((e.innerText||'').trim()));
  if(!lab) return {note:'no Platforms label'};
  const scopes=[lab.nextElementSibling, lab.parentElement].filter(Boolean);
  const seen=new Set(); const icons=[];
  for(const sc of scopes) for(const n of sc.querySelectorAll('*')){
    const cs=getComputedStyle(n); const mask=cs.maskImage||cs.webkitMaskImage||'none'; const bg=cs.backgroundImage||'none';
    if(mask==='none'&&bg==='none') continue;
    const pos=(cs.maskPosition||cs.webkitMaskPosition||cs.backgroundPosition||'').trim();
    const k=pos; if(seen.has(k)) continue; seen.add(k);
    icons.push({ maskPos:pos, sprite:(mask!=='none'?mask:bg).replace(/^url\\("?|"?\\)$/g,'').slice(0,80),
      al:n.getAttribute('aria-label'), title:n.getAttribute('title') });
  }
  return { count:icons.length, icons };
})()`;

async function sample(c, nth) {
  const s = {};
  const ok = await ev(c, `(() => { const b=${MATCH}[${nth}]; if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
  if (!ok) return null;
  await sleep(3800);
  s.platforms = await ev(c, PLATFORMS);
  // labels + fields before expand
  const base = await ev(c, `(() => { const d=${DLG}; if(!d) return null; const t=d.innerText||'';
    return { library_id:(t.match(/(?:Library ID|라이브러리 ID):\\s*([0-9]+)/i)||[])[1]||null,
      started_at:(t.match(/[0-9]{4}\\. ?[0-9]{1,2}\\. ?[0-9]{1,2}\\.?에 게재 시작함/)||t.match(/Started running on .+/)||[])[0]||null,
      status:(t.match(/^(활성|비활성|Active|Inactive)$/m)||[])[0]||null,
      advertiser:(() => { const ls=t.split('\\n').map(x=>x.trim()).filter(Boolean); const i=ls.findIndex(l=>/^(광고|Sponsored)$/.test(l)); return i>0?ls[i-1]:null; })() }; })()`);
  Object.assign(s, base);
  // expand accordion via REAL CDP click (JS .click toggles nothing)
  const rect = await ev(c, ACC_RECT);
  s.accordion_rect = rect;
  if (rect) {
    await c.Input.dispatchMouseEvent({ type: "mouseMoved", x: rect.x, y: rect.y }); await sleep(150);
    await c.Input.dispatchMouseEvent({ type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await c.Input.dispatchMouseEvent({ type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await sleep(2500);
  }
  s.expanded = await ev(c, `(() => { const d=${DLG}; if(!d) return null; const t=d.innerText||'';
    return { full:t.slice(0,4000),
      follower_raw:(t.match(/팔로워\\s*([0-9][0-9.,]*\\s*(?:천|만|억)?\\s*명?)/)||t.match(/([0-9][0-9.,]*[KMB]?)\\s*followers/i)||[])[0]||null,
      page_id:(t.match(/\\bID:\\s*([0-9]+)/)||[])[1]||null,
      category:(() => { const ls=t.split('\\n').map(x=>x.trim()).filter(Boolean); const fi=ls.findIndex(l=>/팔로워|followers/i.test(l)); return fi>=0&&ls[fi+1]?ls[fi+1]:null; })() }; })()`);
  // close
  await c.Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.Input.dispatchKeyEvent({ type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(1500);
  return s;
}

async function main() {
  const { port } = acquirePort("meta-detail-recon");
  const chrome = await launchChrome({ port, userDataDir: "/tmp/gai-meta-recon-kr" });
  const f = { samples: [] }; let c;
  try {
    c = await bound(connect(port), 15000, "connect");
    await bound(c.Network.enable(), 10000, "net");
    await c.Network.setExtraHTTPHeaders({ headers: { "Accept-Language": "ko-KR,ko;q=0.9" } });
    const ua = await ev(c, "navigator.userAgent"); await c.Network.setUserAgentOverride({ userAgent: ua, acceptLanguage: "ko-KR,ko;q=0.9" });
    await bound(c.Page.navigate({ url: FILTER_URL }), 20000, "nav");
    await bound(Promise.race([c.Page.loadEventFired(), sleep(8000)]), 12000, "load");
    await sleep(4500);
    const head = await ev(c, "document.body?document.body.innerText.slice(0,200):''");
    if (/보안.*확인|are you a robot|captcha|security check|access denied|차단/i.test(head)) { f.blocked = true; writeFileSync(`${OUT}/findings_fu.json`, JSON.stringify(f, null, 2)); log("BLOCKED"); return; }
    for (let i = 0; i < 3; i++) { await ev(c, `window.scrollBy(0,1200)`); await sleep(1100); }
    for (const n of [0, 3]) {
      try { const s = await sample(c, n); if (s) f.samples.push(s); } catch (e) { log("sample", n, "err", e?.message); }
    }
    log("samples:", JSON.stringify(f.samples.map(s => ({ adv: s.advertiser, lib: s.library_id, foll: s.expanded?.follower_raw, cat: s.expanded?.category, plat: s.platforms?.icons?.map(i => i.maskPos) })), null, 2));
  } catch (e) { f.error = e?.message; log("ERR", e?.message); }
  finally {
    writeFileSync(`${OUT}/findings_fu.json`, JSON.stringify(f, null, 2));
    log("wrote findings_fu.json");
    try { if (c) await c.close(); } catch {}
    await chrome.close();
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
