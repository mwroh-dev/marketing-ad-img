// SINGLE SOURCE for keyword-plan (TypeBox). PRE-collection demand-based keyword expansion (3 axes → queries).
// Producer = keyword-planner; feeds run-flow keyword search. Lean = fill-signal. ($defs axisTerms inlined.)
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);
const axisTerms = (description?: string) =>
  Type.Array(Type.Object({ term: Type.String({ minLength: 1 }), rationale: Type.Optional(Type.String({ description: "one line: why this term belongs to this axis" })) }, opts), description ? { description } : {});

export const name = "keyword-plan";
export const schema = Type.Object(
  {
    product_id: Type.String({ minLength: 1 }),
    persona_id: Type.String({ minLength: 1 }),
    target_market: Type.String({ minLength: 1, description: "language/market scope the queries are written for, e.g. KR" }),
    axes: Type.Object(
      {
        needs: axisTerms("Needs — the underlying job/desire the buyer is solving"),
        use_case: axisTerms("Use-case — when/where the behavior happens (occasion/scene)"),
        adjacency: axisTerms("Adjacency — products the same buyer also seeks (concrete co-sought nouns)"),
      },
      { ...opts, description: "the three expansion axes (goal is COVERAGE, not precision)" },
    ),
    queries: Type.Array(
      Type.Object({ query: Type.String({ minLength: 1, description: "the actual search string for Meta keyword search" }), mode: U(["keyword"]), axis: U(["needs", "use_case", "adjacency"]) }, opts),
      { minItems: 1, description: "flattened search queries — every query traces to an axis" },
    ),
  },
  { ...opts, $id: "https://marketing-img/schemas/keyword-plan.schema.json", title: "KeywordPlan", description: "pre-collection 3-axis (Needs/Use-case/Adjacency) keyword expansion for coverage" },
);
