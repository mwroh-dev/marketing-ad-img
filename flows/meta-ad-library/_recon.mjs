// THROWAWAY RECON SPIKE (Task 1) — canonical recon for the Meta Ad Library detail modal + video.
// Not part of the shipped flow; kept to document HOW recon-notes.md was produced.
// Drives a dedicated headless Chrome (acquirePort + launchChrome + connect), navigates the public
// front-door filter URL (no media_type ⇒ video included), opens the "See ad details" role=dialog,
// proves DOM-text field extraction (library_id/started_at/status/advertiser/video_duration),
// probes Platforms sprite encoding + follower absence, and collects 2 raw fixture samples.
// Non-intrusive: background, never bringToFront/activateTarget; every CDP step timeout-bounded;
// in-page window.scrollBy only (headless never acks Input.mouseWheel). Usage: node _recon.mjs [kw]
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
const log = (...a) => console.error("[recon5]", ...a);
async function ev(c, e) {
  const { result, exceptionDetails } = await bound(c.Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true }), 15000, "eval");
  if (exceptionDetails) throw new Error(exceptionDetails.text || "eval err");
  return result.value;
}
const DLG = `(() => { const ds=[...document.querySelectorAll('[role="dialog"]')]; return ds.map(d=>({d,t:d.innerText||''})).filter(o=>/Library ID|라이브러리/i.test(o.t)).sort((a,b)=>b.t.length-a.t.length)[0]?.d; })()`;

// Parse the flat detail innerText into structured fields — proves DOM-text extraction is enough.
const PARSE = `(() => {
  const d=${DLG}; if(!d) return null;
  const t=d.innerText||'';
  const lines=t.split('\\n').map(s=>s.trim()).filter(Boolean);
  const libid=(t.match(/Library ID:\\s*([0-9]+)/i)||[])[1]||null;
  const started=(t.match(/Started running on\\s*(.+)/i)||[])[1]||null;
  const status=lines.find(l=>/^(Active|Inactive|활성|비활성)$/.test(l))||null;
  // advertiser = the line just BEFORE 'Sponsored'
  let advertiser=null; const si=lines.indexOf(lines.find(l=>/^(Sponsored|후원)$/.test(l)));
  if(si>0) advertiser=lines[si-1];
  const follower=(t.match(/([0-9.,]+[KMB]?)\\s*(followers|팔로워)/i)||[])[1]||null;
  const dur=(t.match(/\\d+:\\d{2}\\s*\\/\\s*\\d+:\\d{2}/)||[])[0]||null; // present ⇒ video ad
  return { status, library_id: libid, started_at: started, advertiser, follower_raw: follower, video_duration: dur };
})()`;

async function openNth(c, n) {
  // recompute trigger list, click the n-th "See ad details"
  const MATCH = `[...document.querySelectorAll('div[role="button"]')].filter(e => /^(See ad details|상세정보)$/.test((e.innerText||'').trim()))`;
  const ok = await ev(c, `(() => { const b=${MATCH}[${n}]; if(!b) return false; b.scrollIntoView({block:'center'}); b.click(); return true; })()`);
  await sleep(3500);
  return ok;
}
async function closeModal(c) {
  await c.Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await c.Input.dispatchKeyEvent({ type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(1500);
}

async function main() {
  const { port } = acquirePort("meta-detail-recon");
  const chrome = await launchChrome({ port, userDataDir: "/tmp/gai-meta-recon" });
  const f = { samples: [] }; let c;
  try {
    c = await bound(connect(port), 15000, "connect");
    await bound(c.Page.navigate({ url: FILTER_URL }), 20000, "nav");
    await bound(Promise.race([c.Page.loadEventFired(), sleep(8000)]), 12000, "load");
    await sleep(4000);
    for (let i = 0; i < 3; i++) { await ev(c, `window.scrollBy(0,1200)`); await sleep(1100); }

    // open first ad, inspect Platforms sprite + follower hunt
    await openNth(c, 0);
    f.platform_sprites = await ev(c, `(() => {
      const d=${DLG}; if(!d) return null;
      const lab=[...d.querySelectorAll('*')].find(e=>/^(Platforms|플랫폼)$/.test((e.innerText||'').trim()));
      if(!lab) return {note:'no Platforms label'};
      // sibling/parent subtree: the icon row usually follows the label
      const row = lab.nextElementSibling || lab.parentElement;
      const nodes=[...(row?row.querySelectorAll('*'):[])].slice(0,40);
      const styled=nodes.map(n=>{const cs=getComputedStyle(n); return {tag:n.tagName, al:n.getAttribute('aria-label'), bg:(cs.backgroundImage||'').slice(0,70), mask:(cs.maskImage||cs.webkitMaskImage||'').slice(0,70), w:n.getBoundingClientRect().width};}).filter(o=>o.bg!=='none'||o.mask!=='none'||o.al);
      return {label_found:true, styled_nodes: styled.slice(0,12)};
    })()`);
    f.follower_hunt = await ev(c, `(() => { const d=${DLG}; if(!d) return null; const t=d.innerText||''; return {has_followers_word:/followers|팔로워/i.test(t), match:(t.match(/([0-9.,]+[KMB]?)\\s*(followers|팔로워)/i)||[])[0]||null}; })()`);
    f.samples.push(await ev(c, PARSE));
    f.dialog0_raw = await ev(c, `(() => { const d=${DLG}; return d?(d.innerText||'').slice(0,1500):null; })()`);
    await closeModal(c);

    // open a couple more to get a 2nd distinct sample (skip if same)
    for (const n of [3, 6, 9]) {
      const ok = await openNth(c, n);
      if (!ok) continue;
      const s = await ev(c, PARSE);
      if (s && s.library_id && !f.samples.some(x => x.library_id === s.library_id)) {
        f.samples.push(s);
        if (f.samples.length === 1) f.dialog1_raw = await ev(c, `(() => { const d=${DLG}; return d?(d.innerText||'').slice(0,1500):null; })()`);
      }
      await closeModal(c);
      if (f.samples.length >= 2) break;
    }
    log("samples:", JSON.stringify(f.samples, null, 2));
    log("platform_sprites:", JSON.stringify(f.platform_sprites));
    log("follower_hunt:", JSON.stringify(f.follower_hunt));
  } catch (e) { f.error = e?.message; log("ERR", e?.message); }
  finally {
    writeFileSync(`${OUT}/findings5.json`, JSON.stringify(f, null, 2));
    log("wrote findings5.json");
    try { if (c) await c.close(); } catch {}
    await chrome.close();
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
