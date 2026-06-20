// SHAPE sanity only — schema conformance + cheap structural invariants. This does NOT verify the
// producing agent's logical correctness (sound reasoning/judgment); that is the LOGICAL gate in the relevant
// agents/<name>/checklist.md. Shape-valid ≠ correct.

// Validates a user-answer artifact against user-answer.schema.json.
// With no arg, validates a built-in example to prove the schema (Flow B has no slice fixture).
// Usage: tsx scripts/validate-user-answer.ts [path]
import { loadJson, validateAgainst, report } from "../_lib.ts";

const path = process.argv[2];

const data = path
  ? loadJson<any>(path)
  : {
      answer_id: "answer_001",
      run_id: "mock-image-generation",
      raw_answer: "에어프라이어로 1인 가구 타겟 광고 4개 만들어줘. 정사각형이랑 4:5 둘 다.",
      for_blocker: { slot: "formats", question: "어떤 Meta 포맷으로 만들까요?" },
      normalized_slot_updates: [
        { slot: "formats", value: ["meta_square_1_1", "meta_feed_4_5"], resulting_state: "filled", evidence_refs: [] },
        { slot: "candidate_count", value: 4, resulting_state: "filled", evidence_refs: [] }
      ],
      notes: "한 답변이 여러 슬롯을 채운 예시 (formats + candidate_count)."
    };

const label = path ? `user-answer (${path})` : "user-answer (built-in example)";
const ok = report(label, validateAgainst("user-answer.schema.json", data));
process.exit(ok ? 0 : 1);
