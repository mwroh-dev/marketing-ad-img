import { validateAgainst } from "./schema-validate.mjs";

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;
const NEGATED_RE =
  /(not\s+(?:available|claimed|asserted|provided|supplied|mean|indicate|known)|no\s+(?:performance|causal|causality|persona|audience|context|claim)|without|absent|missing|unavailable|unknown|unclear|cannot|can't|does\s+not|do\s+not|is\s+not|are\s+not|never|아니|아닙|않|없|못|모르|모릅|불명확|단정하지|주장하지|의미하지|알 수 없|제공되지|부재|불가|금지|회피)/i;

const FORBIDDEN_PATTERNS = [
  {
    label: "performance claim",
    re: /(CTR|ROAS|spend|conversion|performance|성과|매출|전환\s*(?:율|률|수|건|값|성과)|전환(?:이|은|도|을|를)?\s*(?:좋|높|상승|증가|개선|향상|늘|올랐)|효과(?:가|는|도|를)?\s*(?:좋|높|상승|증가|개선|향상|검증|입증))/i,
  },
  {
    label: "causal claim",
    re: /(caused|because|due to|caus(?:e|al|ality)|때문에|원인|영향으로|덕분에|결과로)/i,
  },
];

const PERSONA_SHIFT_RE = /(페르소나\s*(?:가\s*)?바뀌|페르소나\s*변화|persona\s+shift|audience\s+shift|타겟.*바뀌|대상.*바뀌)/i;

function numbersFrom(value) {
  return new Set(JSON.stringify(value).match(NUMBER_RE) || []);
}

function splitClaims(text) {
  return String(text || "")
    .split(/(?:[\n\r]+|(?<=[.!?。！？])\s+|\bbut\b|\bhowever\b|지만|하지만|그러나|다만)/gi)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isNegated(text) {
  return NEGATED_RE.test(text);
}

export function collectCreativeChangeClaimTexts({ events, report }) {
  const texts = [];
  for (const item of report.confirmed_changes || []) texts.push(item.summary);
  for (const item of report.classified_interpretations || []) texts.push(item.summary);
  for (const item of report.inferred_hypotheses || []) texts.push(item.summary);
  if (report.synthesis) texts.push(report.synthesis);
  for (const event of events.events || []) texts.push(event.summary);
  return texts.filter((text) => typeof text === "string" && text.trim());
}

function pushSchemaErrors(errors, schemaFile, data) {
  const result = validateAgainst(schemaFile, data);
  if (!result.ok) {
    for (const error of result.errors) errors.push(`${schemaFile}: ${error}`);
  }
}

function checkCandidateRefs(errors, events, candidates) {
  const candidateIds = new Set((candidates.candidates || []).map((candidate) => candidate.candidate_id));
  for (const event of events.events || []) {
    for (const id of event.based_on_candidate_ids || []) {
      if (!candidateIds.has(id)) errors.push(`event ${event.event_id} cites unknown candidate_id ${id}`);
    }
  }
}

function checkForbiddenPositiveClaims(errors, texts, candidates) {
  const hasAudienceReadShift = (candidates.candidates || []).some((candidate) => candidate.candidate_type === "audience_read_shift");

  for (const text of texts) {
    for (const claim of splitClaims(text)) {
      if (isNegated(claim)) continue;
      for (const { label, re } of FORBIDDEN_PATTERNS) {
        if (re.test(claim)) errors.push(`${label}: ${claim}`);
      }
      if (!hasAudienceReadShift && PERSONA_SHIFT_RE.test(claim)) {
        errors.push(`persona/audience shift claim without audience_read_shift candidate: ${claim}`);
      }
    }
  }
}

function checkNumberFidelity(errors, texts, inputs) {
  const inputNumbers = numbersFrom(inputs);
  for (const text of texts) {
    for (const number of text.match(NUMBER_RE) || []) {
      if (!inputNumbers.has(number)) errors.push(`number not present in input artifacts: ${number}`);
    }
  }
}

function checkContextBoundary(errors, events, report, contextCalendar) {
  if (contextCalendar) return;
  if ((report.inferred_hypotheses || []).length !== 0) {
    errors.push("inferred_hypotheses must be empty when no context-calendar was supplied");
  }
  if ((events.events || []).some((event) => event.claim_kind === "inferred")) {
    errors.push("inferred interpreted-change events require context-calendar");
  }
  const coverage = String([...(report.coverage_flags || []), ...(events.coverage_flags || [])].join(" "));
  if (!/context|external|맥락|외부/i.test(coverage)) {
    errors.push("coverage_flags should mention missing external context");
  }
}

export function evaluateCreativeChangeAgentOutput({ diff, candidates, events, report, contextCalendar = null }) {
  const errors = [];

  pushSchemaErrors(errors, "creative-diff.schema.json", diff);
  pushSchemaErrors(errors, "change-candidate.schema.json", candidates);
  pushSchemaErrors(errors, "interpreted-change-event.schema.json", events);
  pushSchemaErrors(errors, "creative-change-report.schema.json", report);
  if (contextCalendar) pushSchemaErrors(errors, "context-calendar.schema.json", contextCalendar);

  checkCandidateRefs(errors, events, candidates);
  const claimTexts = collectCreativeChangeClaimTexts({ events, report });
  checkForbiddenPositiveClaims(errors, claimTexts, candidates);
  checkNumberFidelity(errors, claimTexts, { diff, candidates, contextCalendar });
  checkContextBoundary(errors, events, report, contextCalendar);

  return { ok: errors.length === 0, errors };
}

export function assertCreativeChangeAgentOutput(input) {
  const result = evaluateCreativeChangeAgentOutput(input);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result;
}
