// Pure, platform-agnostic helpers shared by ad-source adapters + the collection harness.

// Guard against path traversal: runId/personaId/source flow straight into filesystem paths
// under .generate-ads-img/. A value like "../../tmp/evil" would escape the state sandbox and
// let mkdirSync/writeFileSync touch arbitrary locations. Reject anything that is not a single
// path segment (no separators, no "." / ".." , no NUL).
export function safeName(id, label = "name") {
  if (id == null || typeof id !== "string" || id === "" || id === "." || id === ".." || /[\/\\\0]/.test(id)) {
    throw new Error(`${label} must be a simple name (no path separators, not '.'/'..'): ${JSON.stringify(id)}`);
  }
  return id;
}

export function parseAdvertiserId(href) {
  if (!href) return null;
  const m = String(href).match(/\/advertiser\/(AR\w+)/);
  return m ? m[1] : null;
}

export function filterQueriesByModes(queries, acceptModes) {
  const set = new Set(acceptModes || []);
  return (queries || []).filter((q) => set.has(q.mode));
}

export function dedupKey(url) {
  return String(url).split("?")[0];
}

// Pick the best advertiser suggestion for a query, avoiding wrong substring matches
// (e.g. "토스" must NOT silently resolve to "파낙토스"). suggestions: [{text, x, y, ...}]
// where text is the suggestion item's innerText (first line = advertiser name).
// Returns { index, name, quality } with quality "exact" | "prefix" | "loose", or null if
// no suggestion's name relates to the query at all. The caller decides whether to accept a
// "loose" (substring-only) match and how to label resolved_via.
export function chooseAdvertiser(suggestions, query) {
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const q = norm(query);
  if (!q || !Array.isArray(suggestions)) return null;
  let best = null;
  suggestions.forEach((s, i) => {
    const name = norm(String(s.text || "").split("\n")[0]);
    if (!name) return;
    let quality = null;
    if (name === q) quality = "exact";
    else if (name.startsWith(q) || q.startsWith(name)) quality = "prefix";
    else if (name.includes(q) || q.includes(name)) quality = "loose";
    if (!quality) return;
    const rank = { exact: 3, prefix: 2, loose: 1 }[quality];
    if (!best || rank > best.rank) best = { index: i, name: String(s.text || "").split("\n")[0].trim(), quality, rank };
  });
  if (!best) return null;
  const { rank, ...rest } = best;
  return rest;
}
