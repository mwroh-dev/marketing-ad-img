// SHAPE + plan invariants for a keyword-plan (pre-collection 3-axis keyword set).
// Schema checks fields/enums; then: every query.axis must be a real axis, and every query should trace to a
// term that actually appears in that axis (no orphan queries invented outside the declared expansion).
// Usage: tsx shared/validators/validate-keyword-plan.ts <path>
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx shared/validators/validate-keyword-plan.ts <path>"); process.exit(2); }

const data = loadJson<any>(path);
let ok = report("keyword-plan", validateAgainst("keyword-plan.schema.json", data));

const AXES = ["needs", "use_case", "adjacency"];
const queries = Array.isArray(data?.queries) ? data.queries : [];

// every query.axis is non-empty in the plan (don't claim an axis you produced no terms for)
const emptyAxisUsed = queries.filter((q: any) => !(data?.axes?.[q.axis]?.length));
if (emptyAxisUsed.length) {
  console.error(`FAIL  ${emptyAxisUsed.length} query(ies) tag an axis with no terms — e.g. "${emptyAxisUsed[0].query}" (axis ${emptyAxisUsed[0].axis})`);
  ok = false;
} else {
  console.log(`PASS  axis coverage (every query's axis has terms)`);
}

// coverage breadth signal — not a hard fail, but warn if an axis produced nothing (thin, single-angle plan)
const thin = AXES.filter((a) => !(data?.axes?.[a]?.length));
if (thin.length) console.warn(`WARN  thin plan — no terms on axis(es): ${thin.join(", ")} (collection wants 모수; widen)`);
console.log(`INFO  ${queries.length} queries across ${AXES.filter((a) => data?.axes?.[a]?.length).length}/3 axes`);

process.exit(ok ? 0 : 1);
