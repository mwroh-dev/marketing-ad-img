---
name: agent-browser-exploration
description: Explore an unknown browser source with agent-browser and produce a discovery report and candidate flow notes only.
---

# Exploring an unknown browser source

You are mapping a source nobody has charted yet — finding where things are, how
search works, what the results look like, and where the walls are. The output is
a *discovery report*, not data. Exploration answers "could we collect here, and
how?"; it never actually collects. Confusing the two is the main failure mode.

## When to use it

Use this when a `source_target` is unmapped and a caller wants to know whether
and how an automation flow could work against it (Flow D1 — discovery only).
If the source is already mapped and you're being asked to pull records, that is
collection — a different job. Stop and hand back.

Require all of: `source_target` (+ its `allowed_domains`), `collection_goal`,
`browser_profile_id`, and a `cdp_port_id`. If any is missing, abort and say
which — you cannot probe safely without scope and a claimed port.

## The method, step by step

1. **Acquire a CDP port and open a background tab.** Get a probed-free port via
   `node shared/collect/acquire-port.mjs <task>` (9223–9299, self-contained).
   Never hardcode `9222` for a named task. Drive everything in a background tab —
   non-intrusive is a hard rule: no `bringToFront`, no `activateTarget`, never
   touch the tab the user is looking at. The user must be able to keep working
   while you explore.

2. **Enter through the front door, in scope.** Start from the source's public
   entry URL within `allowed_domains`. The moment navigation would leave the
   allowed domains, stop and record it — do not follow off-scope links "just to
   see." Note the entry points you find: landing page, search page, category
   indexes, direct listing URLs.

3. **Probe affordances with real interactions.** Find and exercise the search
   box, filters, sort controls, and pagination by *actually clicking, typing,
   and scrolling* — the same way a person would. Never inject DOM values, never
   fire synthetic submit/Enter events, never assemble result or pagination URLs
   by hand. You are testing what a real user flow can reach; faked input maps a
   path that real collection won't be able to walk.

4. **Read the result structure.** Once results render, record how they're shaped:
   the repeating element/container pattern, which fields are visible per item
   (title, image, price, date…), how pagination advances (numbered, infinite
   scroll, "more" button), and how much data appears reachable without auth.

5. **Watch for walls — and STOP at them.** Login gates, consent walls, captchas,
   anti-bot challenges, rate-limit/403 responses. When you hit one, record it in
   the blocker report and stop that path. Do NOT escalate: no bypass, no stealth,
   no captcha-solving, no credential or session reuse. (The one narrow exception
   that is *not* a bypass: on a public, no-auth source, normalizing a headless
   `HeadlessChrome` UA to a standard Chrome UA — that removes a headless artifact,
   it does not defeat a real control. Anything stronger than that → STOP.)

6. **Never persist secrets.** Do not store, log, or transmit credentials,
   cookies, or session tokens at any point.

7. **Write the three discovery artifacts** to
   `.generate-ads-img/runs/{run_id}/discovery/`:
   - `discovery-report.json` — entry points, search/filter affordances, result
     element patterns, pagination structure, observed data availability.
   - `candidate-flow-notes.json` — informal sketches of *possible* automation
     flows. Always labelled Flow D1, status always `candidate`. You do not
     promote flows — that is the external `.claude` browser-flow skill's (capture) job (referenced via `.generate-ads-img/registry/promoted-flows.yaml`, not reimplemented here).
   - `blocker-report.json` — every access wall hit, with the URL and the signal
     that revealed it (login redirect, captcha, 403, etc.).

## Judgment calls

- **"Is this exploration or collection?"** If you're recording *how the source
  is shaped*, it's exploration. If you're harvesting *the records themselves*
  into a dataset, you've crossed into collection — stop.
- **"Promote this flow?"** Never here. Discovery only ever emits `candidate`
  status. Promotion is a separate, downstream decision.
- **"This wall might be passable with a trick."** That instinct is the trap.
  STOP-on-block is not a soft preference; the correct output of hitting a wall is
  a blocker-report entry, not a workaround.
- **"Out-of-scope link looks relevant."** Scope is the boundary, not a
  suggestion. Record it as a lead in the report, but do not navigate there.

## Pitfalls and how to avoid them

- **Drifting into collection.** Easy to do once results render and look
  harvestable. Keep asking "am I describing structure, or extracting data?"
- **Faking input to get past a step.** DOM value injection / synthetic submit /
  hand-built URLs produce a map that real, click-driven collection cannot follow
  — worse than no map. Only record paths reachable by genuine interaction.
- **Stealing focus.** `bringToFront`/`activateTarget`/foreground tabs break the
  non-intrusive contract. Stay in the background tab.
- **Escalating past a block.** The instant you reach for stealth or a captcha
  solver, you've violated the discipline. STOP and report.

## What a good discovery report contains

A downstream reader should be able to answer, from your report alone: *Where do
I enter? How do I search and filter? What does one result item look like and
which fields are exposed? How does pagination work? What walls block deeper
access, and where exactly?* If any of those is unanswerable, the discovery is
incomplete — note the gap explicitly rather than guessing.

## Worked illustration

Goal: "map product listing pages" for a public store source.

1. Claim port → open background tab → land on the store's public home (in scope).
2. Click into the real search box, type a category term, press the real search
   button. Results render.
3. Record: results are a repeating `article.product-card` grid; each card shows
   title, thumbnail, price, rating. Pagination is a numbered footer (not infinite
   scroll). No login required to view listings.
4. Click page 2 (real click) — confirm the pagination flow works without auth.
5. Open a product detail — hit a "로그인 후 리뷰 확인" gate. STOP that path,
   write it to `blocker-report.json` (reviews are auth-gated), do not attempt to
   log in.
6. Emit `discovery-report.json` (listings fully reachable, structure above),
   `candidate-flow-notes.json` (Flow D1, candidate: search→grid→paginate),
   `blocker-report.json` (review data behind login).

Result: a clear map of what's collectable and a flagged wall — and zero rows
collected.
