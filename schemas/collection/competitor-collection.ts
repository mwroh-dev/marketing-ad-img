// SINGLE SOURCE for competitor-collection (TypeBox). Per confirmed advertiser, the creatives collected from a
// public ad-transparency library. CODE-produced (collector); no agent reads it as a contract. Parity gate.
import { Type } from "@sinclair/typebox";
const opts = { additionalProperties: false } as const;
const Nullable = (t: any) => Type.Union([t, Type.Null()]);

export const name = "competitor-collection";
export const schema = Type.Object(
  {
    from: Type.String({ minLength: 1 }),
    confirmed_targets: Type.Array(Type.String()),
    source: Type.String({ minLength: 1 }),
    collected: Type.Integer({ minimum: 1 }),
    products: Type.Array(
      Type.Object(
        {
          idx: Type.Integer(),
          query: Type.String({ minLength: 1 }),
          host: Type.String({ minLength: 1 }),
          title: Type.String({ minLength: 1 }),
          price: Type.Optional(Nullable(Type.String())),
          rating: Type.Optional(Nullable(Type.String())),
          reviewCount: Type.Optional(Nullable(Type.String())),
          image_urls: Type.Array(Type.String()),
          image_files: Type.Array(Type.String()),
          review_count_collected: Type.Optional(Type.Integer()),
          reviews: Type.Array(Type.String()),
        },
        opts,
      ),
      { minItems: 1 },
    ),
    captured_at: Type.String(),
  },
  { ...opts, $id: "https://marketing-img/schemas/competitor-collection.schema.json", title: "CompetitorCollection", description: "creatives collected from a public ad-transparency library (credential-free)" },
);
