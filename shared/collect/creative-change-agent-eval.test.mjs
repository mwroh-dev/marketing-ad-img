import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCreativeChangeAgentOutput } from "./creative-change-agent-eval.mjs";

const diff = {
  from_snapshot_id: "run-a",
  to_snapshot_id: "run-b",
  persona_id: "p1",
  inventory_delta: {
    created: [{ ad_key: "L4", library_id: "L4", image_ref: "runs/run-b/ad-creatives/p1/images/ad-2.jpg" }],
    deleted: [{ ad_key: "L3", library_id: "L3", image_ref: "runs/run-a/ad-creatives/p1/images/ad-2.jpg" }],
    persisted: [
      { ad_key: "L1", library_id: "L1", image_ref: "runs/run-b/ad-creatives/p1/images/ad-0.jpg" },
      { ad_key: "L2", library_id: "L2", image_ref: "runs/run-b/ad-creatives/p1/images/ad-1.jpg" },
    ],
    untrackable: [],
  },
  update_delta: {
    same_library_id_changed_recipe: [
      {
        library_id: "L1",
        changed_axes: ["text_hash", "appeal"],
        before: { appeal: "quality_proof" },
        after: { appeal: "emotional" },
        evidence_refs: ["p1/ad-0/intent.json"],
      },
    ],
  },
  distribution_delta: {
    appeal: {
      from_count: 3,
      to_count: 3,
      confidence_floor: "high",
      values: {
        emotional: { from: 0, to: 0.6667, delta: 0.6667, support_count: 2 },
        quality_proof: { from: 1, to: 0.3333, delta: -0.6667, support_count: 4 },
      },
    },
  },
  coverage_flags: [],
};

const candidates = {
  from_snapshot_id: "run-a",
  to_snapshot_id: "run-b",
  candidates: [
    {
      candidate_id: "candidate_001",
      candidate_type: "appeal_shift",
      claim_kind: "computed",
      input_claim_kinds: ["classified"],
      axis: "appeal",
      from: "quality_proof",
      to: "emotional",
      support_count: 2,
      share_delta: 0.6667,
      strength: "strong",
      evidence_refs: ["appeal:emotional"],
      coverage_flags: [],
    },
  ],
  coverage_flags: [],
};

function events(summary = "emotional 소구 비중은 0에서 0.6667로 늘었습니다. 이는 성과나 효과를 의미하지 않습니다.") {
  return {
    persona_id: "p1",
    events: [
      {
        event_id: "event_001",
        based_on_candidate_ids: ["candidate_001"],
        event_type: "appeal_shift",
        claim_kind: "interpreted",
        summary,
        evidence_refs: ["candidate_001"],
        confidence: "high",
        forbidden_claims_checked: ["no_performance_or_ctr_or_roas_or_spend_claimed"],
      },
    ],
    coverage_flags: ["external_context_not_supplied: no inferred hypotheses produced."],
  };
}

function report(overrides = {}) {
  return {
    persona_id: "p1",
    snapshot_range: { from_snapshot_id: "run-a", to_snapshot_id: "run-b" },
    confirmed_changes: [
      {
        claim_kind: "computed",
        summary: "appeal 분포 변화: emotional 0 -> 0.6667, quality_proof 1 -> 0.3333.",
        evidence_refs: ["candidate_001"],
      },
    ],
    classified_interpretations: [
      {
        claim_kind: "interpreted",
        summary: "소구점이 emotional 중심으로 재배치되었습니다. 성과 변화가 아닙니다.",
        evidence_refs: ["candidate_001"],
      },
    ],
    inferred_hypotheses: [],
    coverage_flags: [
      "external_context_not_supplied: context-calendar.json absent.",
      "no_performance_data: any performance, CTR, ROAS, spend, or conversion outcomes are not available and are not claimed.",
      "no_audience_read_shift_candidate: no persona/audience shift asserted.",
    ],
    synthesis:
      "원인이나 성과는 단정하지 않습니다. 페르소나 변화도 주장하지 않습니다. 관측·계산된 변화만 제시합니다.",
    ...overrides,
  };
}

const contextCalendar = {
  persona_id: "p1",
  date_range: { from: "2026-06-01", to: "2026-06-08" },
  events: [
    {
      event_type: "season",
      date_range: { from: "2026-06-01", to: "2026-06-08" },
      summary: "seasonal context",
      sources: ["fixture"],
      confidence: "medium",
    },
  ],
  coverage_flags: [],
};

test("creative-change agent eval accepts negated performance, causality, and persona disclaimers", () => {
  const result = evaluateCreativeChangeAgentOutput({ diff, candidates, events: events(), report: report() });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("creative-change agent eval normalizes date and leading-zero numbers for fidelity", () => {
  const result = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    contextCalendar,
    events: events("2026년 6월 1일에 관찰된 외부 맥락과 같은 기간에 있었습니다."),
    report: report(),
  });

  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("creative-change agent eval accepts non-performance creative transition/effect wording", () => {
  const result = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("품질 증명에서 감성 소구로의 전환으로 읽힙니다. 시각적 대비 효과가 강조되었습니다. 시각적 대비 효과가 있었습니다. 원인은 모릅니다."),
    report: report(),
  });

  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("creative-change agent eval rejects positive forbidden claims", () => {
  const performance = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("CTR improved after the shift."),
    report: report(),
  });
  assert.equal(performance.ok, false);
  assert.match(performance.errors.join("\n"), /performance/i);

  const conversionRate = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("전환율이 상승했습니다."),
    report: report(),
  });
  assert.equal(conversionRate.ok, false);
  assert.match(conversionRate.errors.join("\n"), /performance/i);

  const conversionIncrease = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("전환이 증가했습니다."),
    report: report(),
  });
  assert.equal(conversionIncrease.ok, false);
  assert.match(conversionIncrease.errors.join("\n"), /performance/i);

  const performanceEffect = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("광고 효과가 개선되었습니다."),
    report: report(),
  });
  assert.equal(performanceEffect.ok, false);
  assert.match(performanceEffect.errors.join("\n"), /performance/i);

  const causal = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("이 이벤트 때문에 appeal이 바뀌었습니다."),
    report: report(),
  });
  assert.equal(causal.ok, false);
  assert.match(causal.errors.join("\n"), /causal|cause|인과/);

  const persona = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("페르소나가 바뀌었습니다."),
    report: report(),
  });
  assert.equal(persona.ok, false);
  assert.match(persona.errors.join("\n"), /persona|audience/);
});

test("creative-change agent eval rejects positive claims after disclaimer contrast", () => {
  const result = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events("성과는 단정하지 않지만 CTR improved after the shift."),
    report: report(),
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /performance/i);
});

test("creative-change agent eval rejects numbers not present in input artifacts", () => {
  const result = evaluateCreativeChangeAgentOutput({
    diff,
    candidates,
    events: events(),
    report: report({
      confirmed_changes: [
        {
          claim_kind: "computed",
          summary: "appeal 분포 변화: emotional 0 -> 0.7777.",
          evidence_refs: ["candidate_001"],
        },
      ],
    }),
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /0\.7777/);
});
