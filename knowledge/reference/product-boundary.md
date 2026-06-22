# 00. Product Boundary

## Product Definition

`marketing-img` is a prompt candidate generation system for producing ad image creatives.

The user makes requests from within Claude Code. The system evaluates the request, and when required information is missing it runs a criteria-driven interview loop. Once the conditions are met, it combines data, knowledge, and the request to produce image generation prompt candidates.

## Target & Ad Sources

- **Target is domain-neutral** — the consumer's specific brand/product/persona is configured at runtime (initial-setup), NOT fixed in the system. A specific seller is one possible instance, not the product definition. The output is a media-neutral "ad image creative"; Meta (FB+IG) is one output mode.
- **Ad sources = public ad-transparency libraries: {Meta Ad Library, Google Ads Transparency}** — intended-public, no login. They supply competitor/market ad creatives for pattern analysis. The source set is **market/persona-driven, not a fixed global list**; for a Korea-targeting consumer the lever is the `country=KR` filter on these two, not adding platforms. Future global/vertical-market source candidates (Pinterest/LinkedIn/Snapchat/X/Microsoft) are documented as backlog in `ad-source-expansion-backlog.md` — activated per consumer, never pre-wired.
- **Detail cuts** are analyzed from the **seller's own / user-provided images** (their own product detail page), passed through the **image refiner** so that only the "persuasion detail-cut (= ad)" is separated for analysis (excluding plain catalog/spec/review/lifestyle cuts). The system does not collect competitor detail cuts from third-party stores.

## In Scope

- Defining brand/product/persona structure
- Managing global marketing/copy/layout/ad-format principles
- Managing domain knowledge based on specific brands/products/competitors/reviews
- Competitor/advertiser discovery within the public ad-transparency libraries
- **Collection of competitor/market ad creatives from public ad-transparency libraries (Meta Ad Library, Google Ads Transparency)** via a CDP profile, under STOP-on-block guardrails — public, no login, no third-party-store scraping
- Analysis of the seller's own / user-provided detail-cut images (image refiner)
- request evaluation
- criteria-driven interview loop
- Structuring answers via user-answer-tooling
- image prompt candidate generation
- ChatGPT/Gemini prompt adapter
- adapter verification checklist generation
- Node-based product cutout/cleanup script
- candidate selection log
- Documenting the performance learning backlog

## Out of Scope

- Actual ad execution
- Meta Ads Manager upload
- Real image provider API/UI calls
- Automatic performance collection
- multi-user SaaS permission system
- Server/remote machine sync
- Reimplementing browser-flow
- bypass/stealth/captcha-solving/lock avoidance features
- A separate CLI for running modes

## MVP Output

The final output is not an actual image but the following artifact.

```json
{
  "creative_brief": "...",
  "candidate_count": 4,
  "candidates": [
    {
      "candidate_id": "candidate_001",
      "angle": "product_usp",
      "provider_neutral_spec": {},
      "adapter_outputs": {
        "chatgpt_image": {},
        "gemini_image": {}
      },
      "verification_checklist": []
    }
  ],
  "candidate_selection_log": {}
}
```
