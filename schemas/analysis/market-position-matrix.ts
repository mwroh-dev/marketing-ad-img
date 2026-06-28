// SINGLE SOURCE for market-position-matrix (TypeBox). Per-persona benefit×funnel positioning matrix —
// CODE-computed (market-position-aggregate). Consumed by creative-opportunity-mapper. The original used $ref/$defs;
// TypeBox inlines the shared shapes (validation-identical). Lean descriptions = fill-signal.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const intMin0 = () => Type.Integer({ minimum: 0 });

const funnelRow = () => Type.Object({ discovery: intMin0(), comparison: intMin0(), action: intMin0(), retention: intMin0(), unclear: intMin0() }, opts);
const positionNoteList = (description?: string) =>
  Type.Array(Type.Object({ position: Type.String(), reason: Type.String() }, opts), description ? { description } : {});

export const name = "market-position-matrix";
export const schema = Type.Object(
  {
    persona_id: Type.String({ minLength: 1 }),
    total_ads: intMin0(),
    by_benefit_and_funnel: Type.Object(
      { function: funnelRow(), cost: funnelRow(), trust: funnelRow(), symbol: funnelRow(), unclear: funnelRow() },
      { ...opts, description: "FULL benefit×funnel grid — 0 cells ARE the whitespace signal (counts = observed prevalence, NOT performance)" },
    ),
    dominant_positions: Type.Optional(
      Type.Array(
        Type.Object(
          { position: Type.String(), count: intMin0(), share: Type.Number(), common_ad_types: Type.Optional(Type.Array(Type.String())), common_execution_styles: Type.Optional(Type.Array(Type.String())), common_devices: Type.Optional(Type.Array(Type.String())) },
          opts,
        ),
      ),
    ),
    crowded_positions: Type.Optional(positionNoteList("high observed frequency")),
    whitespace_positions: Type.Optional(positionNoteList("low observed frequency — a GAP, not a guaranteed opportunity")),
    high_reusability_patterns: Type.Optional(Type.Array(Type.Object({ position: Type.String(), devices: Type.Optional(Type.Array(Type.String())), why_reusable: Type.Optional(Type.String()) }, opts))),
    risks: Type.Optional(Type.Array(Type.Object({ risk: Type.String(), reason: Type.String() }, opts))),
    coverage_flags: Type.Optional(Type.Array(Type.String())),
    generated_at: Type.Optional(Type.String()),
  },
  { ...opts, $id: "https://marketing-img/schemas/market-position-matrix.schema.json", title: "MarketPositionMatrix", description: "per-persona benefit×funnel positioning matrix (observed prevalence, not performance); whitespace = low frequency" },
);
