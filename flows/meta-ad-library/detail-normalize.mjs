// Pure normalization of the Meta detail-modal raw fields scraped in-page (recon-verified, KR⊥EN).
// Selectors live in flow.mjs (live-confirmed via recon-notes.md); this module is the testable cleanup layer.

const KR_MULT = { 천: 1e3, 만: 1e4, 억: 1e8 };
const EN_MULT = { k: 1e3, m: 1e6, b: 1e9 };

export function parseFollowerCount(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  // KR: number + optional 천/만/억 (+ optional 명)
  let m = s.match(/([\d.,]+)\s*(천|만|억)?\s*명/);
  if (!m) m = s.match(/([\d.,]+)\s*(천|만|억)/);
  if (m) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(num)) return null;
    return Math.round(num * (m[2] ? KR_MULT[m[2]] : 1));
  }
  // EN: number + optional K/M/B (+ optional "followers")
  m = s.match(/([\d.,]+)\s*([KMBkmb])?\s*(?:followers?)?/i);
  if (m && m[1] && /\d/.test(m[1])) {
    const num = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(num)) return null;
    return Math.round(num * (m[2] ? EN_MULT[m[2].toLowerCase()] : 1));
  }
  return null;
}

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
const pad = (n) => String(n).padStart(2, "0");

export function parseStartedAt(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  // KR: "2026. 2. 26.에 게재 시작함" → extract "2026. 2. 26"
  let m = s.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  // EN: "...26 Feb 2026"
  m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${pad(mo)}-${pad(+m[1])}`;
  }
  return null;
}

// mask-position Y-offset → platform. recon §8c (🟡 best-inference; keep raw offset for unknowns).
const PLATFORM_BY_YOFFSET = { "-766px": "facebook", "-805px": "instagram", "-818px": "messenger", "-831px": "threads" };

export function mapPlatforms(offsets) {
  if (!Array.isArray(offsets)) return [];
  return offsets.map((o) => {
    const y = String(o).trim().split(/\s+/).pop();   // "-387px -766px" → "-766px"
    return PLATFORM_BY_YOFFSET[y] || `unknown(${y})`;
  });
}

export function normalizeStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "활성" || s === "active") return "active";
  if (s === "비활성" || s === "inactive") return "inactive";
  return "unknown";
}

export function normalizeDetail(raw = {}) {
  const out = {};
  const status = normalizeStatus(raw.status);
  if (raw.status != null && String(raw.status).trim()) out.status = status;
  const lib = (raw.library_id ?? "").toString().trim();
  if (lib) out.library_id = lib;
  const started = parseStartedAt(raw.started_at);
  if (started) out.started_at = started;
  const adv = (raw.advertiser ?? "").toString().trim();
  if (adv) out.advertiser_name = adv;
  const fc = parseFollowerCount(raw.follower_raw);
  if (fc != null) out.follower_count = fc;
  const cat = (raw.category ?? "").toString().trim();
  if (cat) out.page_category = cat;
  const pid = (raw.page_id ?? "").toString().trim();
  if (pid) out.page_id = pid;
  const platforms = mapPlatforms(raw.platform_offsets);
  if (platforms.length) out.platforms = platforms;
  const dur = (raw.video_duration ?? "").toString().trim();
  if (dur) out.video_duration = dur;
  out.detail_captured = Object.keys(out).length > 0;
  return out;
}
