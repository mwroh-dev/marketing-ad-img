// Real-interaction CDP helpers for marketing-img data collection. Source-agnostic primitives
// (work against any public search/list surface — e.g. the Meta Ad Library / Google Ads
// Transparency front doors).
// Compliance: navigation is to site ROOTS / whitelisted tool front-doors only; interaction uses
// real CDP Input events (mouse clicks + keystrokes), never DOM value injection / synthetic
// submit / URL assembly.
// chrome-remote-interface is a direct project dependency (decoupled from browser-flow's
// internal runtime) so these collectors run in any project that installs deps.
import CDP from "chrome-remote-interface";

export async function connect(port = 9290) {
  const targets = await CDP.List({ port });
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    page = await CDP.New({ port, url: "about:blank" });
  }
  const client = await CDP({ port, target: page.id ?? page.webSocketDebuggerUrl });
  await client.Page.enable();
  await client.Runtime.enable();
  await client.DOM.enable();
  return client;
}

// NON-INTRUSIVE automation (do not steal the user's cursor/focus). Create the automation tab
// in the BACKGROUND so the user can keep working in their active window. Input.* events are
// page-level and never move the OS cursor; we also NEVER call Page.bringToFront /
// Target.activateTarget. Collectors should drive an openBackgroundTab() client, not navigate
// the user's foreground page. (See ~/.claude/rules/cdp-non-intrusive.md)
export async function openBackgroundTab(url = "about:blank", port = 9290) {
  const tmp = await CDP({ port });                 // attach to an existing target (passive; no foregrounding)
  const { targetId } = await tmp.Target.createTarget({ url, background: true });
  await tmp.close();
  const client = await CDP({ port, target: targetId });
  await client.Page.enable();
  await client.Runtime.enable();
  await client.DOM.enable();
  return client;
}

export async function gotoRoot(client, url) {
  // SHALLOW-ENTRY navigation. Allowed direct entry points are homepage-level only:
  //   - a site ORIGIN (e.g. https://www.example.com/)
  //   - a single shallow first-segment path (e.g. https://www.example.com/section)
  // Anything deeper — product/result/pagination paths (≥2 segments or /products|/catalog|
  // /search), or any querystring/hash — is HACKY deep-linking: it is stripped to the origin.
  // Deep content (a specific product, a search result) must be reached FROM here by real
  // search + click, never by navigating an assembled URL. Direct deep-links trip bot-walls
  // ("service unavailable") and violate the no-URL-assembly rule.
  let u;
  try { u = new URL(url); } catch { throw new Error(`gotoRoot: invalid url ${url}`); }
  const segs = u.pathname.split("/").filter(Boolean);
  const isDeep = segs.length > 1 || !!u.search || !!u.hash || /products|catalog|search/i.test(u.pathname);
  let dest;
  if (isDeep) {
    dest = u.origin + "/";
    console.error(`  [gotoRoot] deep/hacky URL reduced to origin: ${url} → ${dest}. Reach products/results via real search + click, not a direct URL.`);
  } else {
    dest = u.origin + (segs.length ? "/" + segs[0] : "/");   // origin or shallow storefront
  }
  await client.Page.navigate({ url: dest });
  await waitLoad(client);
}

// Whitelisted tool navigation. A public search-tool front-door (e.g. the Ad Library landing)
// lives at a path, which gotoRoot would strip. gotoTool allows navigating to it ONLY if it
// matches a registry whitelist — and always navigates the CLEAN whitelisted URL (never the
// caller's query params). This is the tool's front door, NOT a result deep-link.
export function matchToolEntry(url, allowed) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const path = u.pathname.replace(/\/+$/, "");
  for (const a of allowed) {
    let x; try { x = new URL(a); } catch { continue; }
    if (x.origin === u.origin && x.pathname.replace(/\/+$/, "") === path) return a;
  }
  return null;
}

export async function gotoTool(client, url, allowed) {
  const entry = matchToolEntry(url, allowed);
  if (!entry) throw new Error(`gotoTool: ${url} is not a whitelisted tool entrypoint`);
  await client.Page.navigate({ url: entry });   // clean front-door only; never assembled params
  await waitLoad(client);
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function waitLoad(client, ms = 6000) {
  await Promise.race([client.Page.loadEventFired(), sleep(ms)]);
  await sleep(800);
}

export async function evalJS(client, expression) {
  const { result, exceptionDetails } = await client.Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text || "eval error");
  return result.value;
}

// center coordinates of a real element by selector (for a real mouse click)
export async function centerOf(client, selector) {
  return evalJS(client, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) };
  })()`);
}

// REAL mouse click via CDP Input (browser-level, not a synthetic DOM event)
export async function realClick(client, selector) {
  const c = await centerOf(client, selector);
  if (!c) throw new Error("element not visible: " + selector);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.Input.dispatchMouseEvent({ type, x: c.x, y: c.y, button: "left", clickCount: 1 });
  }
  await sleep(300);
}

// REAL text entry via CDP Input.insertText — browser-native insertion that fires trusted
// beforeinput/input events into the focused element. Reliable for Korean/Unicode (per-key
// dispatchKeyEvent drops Hangul due to IME composition). NOT DOM value injection.
export async function realType(client, text) {
  await client.Input.insertText({ text });
  await sleep(250);
}

// REAL keyboard Enter via CDP (trusted hardware-level key event — this is genuine keyboard
// input, NOT a JS-dispatched "synthetic Enter"). Submits the focused search box.
export async function realEnter(client) {
  // FULL key sequence: rawKeyDown → char("\r") → keyUp. Some search boxes do NOT submit on a
  // bare keyDown/keyUp — they only react to the `char` (keypress) event. Still genuine
  // hardware-level keyboard input (a real Enter), NOT a JS-dispatched synthetic submit /
  // form.submit() / requestSubmit(). Live-confirmed against a real search front door: a bare
  // keyUp left the page in place; the full sequence performs a real search navigation.
  await client.Input.dispatchKeyEvent({ type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await client.Input.dispatchKeyEvent({ type: "char", text: "\r", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await client.Input.dispatchKeyEvent({ type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(300);
}

export async function realScroll(client, dy = 800) {
  // Genuine page scroll. headless=new never acks Input.dispatchMouseEvent{mouseWheel}
  // (the call hangs forever), so we scroll the document directly — a real scroll of the
  // page, NOT DOM value injection / synthetic submit. (lib already scrolls via JS in
  // scrollIntoView; cdp-non-intrusive.md lists "real scroll" as allowed.)
  await client.Runtime.evaluate({ expression: `window.scrollBy(0, ${Number(dy) || 800});`, returnByValue: true });
  await sleep(700);
}

// REAL click at viewport coordinates (browser-level mouse event)
export async function realClickAt(client, x, y) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await client.Input.dispatchMouseEvent({ type, x, y, button: "left", clickCount: 1 });
  }
  await sleep(300);
}

// genuine scroll of an element into view (real page scroll, not input/value injection)
export async function scrollIntoView(client, selector) {
  await evalJS(client, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.scrollIntoView({block:'center'}); return !!el; })()`);
  await sleep(500);
}

// list page targets (for new-tab handling after a real click)
export async function listPages(port = 9290) {
  return (await CDP.List({ port })).filter((t) => t.type === "page");
}

export async function attach(targetId, port = 9290) {
  const client = await CDP({ port, target: targetId });
  await client.Page.enable(); await client.Runtime.enable(); await client.DOM.enable();
  return client;
}

// Detect anti-bot / verification walls. On a hit, callers MUST stop (no hackier bypass).
export function isBlocked(text) {
  return /자동.*차단|보안.*확인|비정상적|접근이 제한|security verification|complete the security|verify that you are a real user|are you a robot|captcha|unusual traffic|access denied|차단되었습니다|서비스 접속이 불가|동시에 접속하는 이용자|네트워크 상태가 불안정|시스템\s*오류|에러\s*페이지|잠시 후 다시 접속/i.test(text || "");
}

export async function shot(client, path) {
  const { data } = await client.Page.captureScreenshot({ format: "png" });
  const { writeFileSync, mkdirSync } = await import("fs");
  const { dirname } = await import("path");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(data, "base64"));
}
