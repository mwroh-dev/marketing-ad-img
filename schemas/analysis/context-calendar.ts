// SINGLE SOURCE for context-calendar (TypeBox). External date-range context; never causal by itself.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const U = (vals: string[], o: object = {}) => Type.Union(vals.map((v) => Type.Literal(v)), o);

const DateRange = Type.Object({ from: Type.String({ minLength: 1 }), to: Type.String({ minLength: 1 }) }, opts);

export const name = "context-calendar";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    date_range: DateRange,
    events: Type.Array(
      Type.Object(
        {
          event_type: U(["season", "holiday", "market_issue", "brand_event", "competitor_event", "other"]),
          date_range: DateRange,
          summary: Type.String({ minLength: 1 }),
          sources: Type.Array(Type.String({ minLength: 1 })),
          confidence: U(["high", "medium", "low"]),
        },
        opts,
      ),
    ),
    coverage_flags: Type.Array(Type.String()),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/context-calendar.schema.json", title: "ContextCalendar", description: "external context calendar for creative-change analysis; correlation only, no causality" },
);
