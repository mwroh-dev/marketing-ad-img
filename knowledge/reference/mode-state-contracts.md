# 03. Mode State Contracts

## Modes

```txt
initial-setup
data-collection
competitive-report
image-generation
performance-learning
```

No mode CLI is built. Claude Code reads the mode contract and works from it.

## initial-setup

Purpose:

```txt
Create the baseline state for brand/product/persona/source/browser profile/image adapter/product asset.
```

Required slots — **data-first synergy**. The user supplies POINTERS (hard blockers); category/persona/
positioning are NOT user-defined free-form — they are **research-derived then user-confirmed** (see the
initial-setup runbook's parallel `brand-researcher` step). Asking the user to define category/persona from
scratch is the "cheap signboard" failure this mode exists to avoid.

```yaml
required_slots:
  # POINTERS — hard blockers (the user must supply these; an interview question may be open)
  - brand_name
  - product_list
  - product_url_or_where_sold        # the seller's own product page URL and/or where it is sold
  - target_market                    # {scope: domestic|overseas|both, regions[], languages[]} — scopes all downstream ad/competitor/research queries to the right market + language

  # USER TARGET — optional pointer ("anything else about the brand/products?"); informs, never required
  - user_target_memo                 # soft

  # RESEARCH-DERIVED → CONFIRMED (NOT user-missing hard blockers): brand-researcher surfaces evidence-backed
  # candidates; the interview presents them as CHOICES; the user confirms/edits.
  - product_category                 # derived (positioning angle) → confirmed
  - target_personas                  # derived (reviews angle) → confirmed
  - positioning                      # derived → confirmed
  - forbidden_claims                 # derived (claim risks observed) → confirmed
```

Hard blockers that keep the interview open: `missing_brand_name`, `missing_product_list`,
`missing_product_url_or_where_sold`. Once pointers are in, the orchestrator runs the parallel research step
BEFORE asking the user to confirm category/persona — never block on the derived slots as if the user must
invent them.

Outputs:

```txt
.generate-ads-img/brands/{brand_id}/user-input.json          # the user's pointers + target memo
.generate-ads-img/brands/{brand_id}/research/findings-*.json # brand-researcher angles (page/reviews/positioning)
.generate-ads-img/brands/{brand_id}/                         # confirmed brand/product/persona state
.generate-ads-img/registry/source-targets.yaml
.generate-ads-img/registry/browser-profiles.yaml
config/cdp-ports.yaml
config/image-adapters.yaml
.generate-ads-img/registry/product-assets.yaml
```

## data-collection

Purpose:

```txt
Collect own/competitor/ad/review data, or build a collection flow.
```

Submodes:

```txt
discovery
flow-capture
run-promoted-flow
```

Required slots:

```yaml
required_slots:
  - brand_id
  - collection_order_stage   # own | competitor | category (no next stage until own is complete)
  - source_target_id
  - access_mode              # public | login-required
  - collection_goal
  - browser_profile_id
  - cdp_port
  - flow_mode                # discovery | own/competitor/category-collection | flow-capture | run-promoted-flow
```

Execution blocked when:

```txt
- brand_id missing
- collection_order_stage unclear (entering competitor/category while own is incomplete)
- source_target_id missing
- browser_profile_id missing
- cdp_port missing
- access_mode unclear
- flow_mode unclear
- run-promoted-flow but promoted_flow_id missing
```

### data-collection submode: competitor selection gate
discovery-scout state:
  required: product_id, persona_id, source_surfaces, (seeds optional)
  blocked when: persona_id missing | source_surfaces empty
competitor-curator state:
  required: candidate_pool_ref, persona_id
  blocked when: candidate_pool_ref missing | deep-collect attempted before user confirmation

## image-generation

Purpose:

```txt
Combine brand/product/persona/user request/collected signals/global principles to produce image prompt candidates.
```

Required slots:

```yaml
required_slots:
  - brand_id
  - product_id
  - persona_id
  - creative_objective
  - formats
  - candidate_count
  - image_adapter_id
  - product_asset_id
  - user_request_summary
```

Defaults:

```yaml
candidate_count:
  default: 4
  minimum: 1
  maximum: 12
```

Formats:

```yaml
supported_formats:
  - meta_square_1_1
  - meta_feed_4_5
  - meta_story_9_16
  - meta_landscape_1_91_1
```

## competitive-report

Purpose:

```txt
Interpret ALREADY-COLLECTED ad creatives (across dated snapshots) into a per-persona competitive report:
longevity ranking (run-duration = longevity proxy), per-advertiser variation/cadence, new/disappeared, appeals. Consumer HTML.
Uses PUBLIC-DATA PROXIES only — never measured CTR/ROAS/spend (that is performance-learning, backlog).
```

Required slots:

```yaml
required_slots:
  - brand_id
  - product_id
  - persona_id
  - collection_snapshot   # ≥1 runs/*/ad-creatives/{persona_id}/ad-creative.json for the persona
```

Execution blocked when:

```txt
- the persona has NO collection snapshot (runs/*/ad-creatives/{persona_id}/ad-creative.json absent)
  → hard_block; route to data-collection first. Never emit an empty report.
```

Honest degrade (not a blocker):

```txt
- only 1 dated snapshot (or all snapshots undated/pre-timestamp): longevity + variation render;
  new/disappeared/cadence are OMITTED + flagged. ≥2 dated snapshots over time fill the change axis.
- ads without started_at are excluded from longevity ranking (flagged), not zero-ranked.
```

## performance-learning

Status:

```txt
backlog only
```

Future inputs:

```yaml
future_inputs:
  - campaign_id
  - creative_id
  - impressions
  - clicks
  - conversions
  - spend
  - ctr
  - cvr
  - roas
```
