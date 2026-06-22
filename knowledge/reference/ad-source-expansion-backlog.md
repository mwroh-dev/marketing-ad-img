# Ad Source Expansion — Backlog (not implemented in MVP)

> **Status: BACKLOG.** Not wired in the MVP. The MVP sources stay `{Meta Ad Library, Google Ads Transparency}`. The candidates below are **activated per consumer**, only when the configured market/persona warrants — never pre-wired. This file exists so the analysis is not lost to context compaction.
>
> Scope note: this document is about **global / vertical-market source expansion only**. Korea-domestic store/search surfaces are deliberately out of scope here.

## Governing principle — source set is market/persona-driven, not a fixed global list

An ad library is the **first-party record of ads that advertisers ran ON that platform** (the advertiser uploaded to the platform; the platform publishes it for transparency). It is NOT a web crawl. The corollary that decides everything:

> **A platform's ad library is only useful when the configured consumer's target-market advertisers actually run ads on that platform.**

So the decision to add a source is gated on the consumer's market + persona (set in initial-setup), not on "it's global, add everything." Adding a library whose advertiser base does not overlap the consumer's target market just fills collection with irrelevant foreign advertisers.

## MVP sources (current)

`Meta Ad Library` (FB/IG/Messenger/Threads/Audience Network) + `Google Ads Transparency` (Display Network — global image-banner backbone, ~90% global internet reach). These two are the dominant global **image-ad** surfaces and both expose public first-party libraries. For a Korea-targeting consumer, the lever is the **`country=KR` filter on these two** (Meta flow already uses `country:KR`) — not adding platforms.

## Backlog candidate libraries (image ads, public first-party libraries)

| Platform | Public library | Activate WHEN consumer's target is… | Notes |
|---|---|---|---|
| **Pinterest** | `ads.pinterest.com/ads-repository` | Visual commerce (fashion/home/beauty/decor) in markets with a Pinterest advertiser base (US/EU) | Image-first; strong for visual-commerce verticals |
| **LinkedIn** | `linkedin.com/ad-library` | **B2B / recruitment** | Documents B2B + recruitment ads; image formats present |
| **Snapchat** | `adsgallery.snap.com` | North-America-weighted / Snapchat-strong markets | — |
| **X (Twitter)** | Ads Transparency Center | Only if the target market actively advertises on X | 🟡 Inconsistently maintained since ownership change — low reliability |
| **Microsoft / Bing** | Microsoft Ads Library | EU display-ad coverage | 🟡 Limited to European countries |

## Relevance evidence — why these are NOT defaults (Korea consumer baseline)

For a Korean **consumer-goods** seller these candidates carry little value; their libraries are dominated by foreign advertisers. They become assets only when the target flips to global / visual-commerce / B2B.

| Platform | KR penetration | KR ad spend | As KR-consumer reference |
|---|---|---|---|
| LinkedIn | 8.9% (low, B2B only) | △ B2B only | 🔴 meaningless for consumer-goods sellers |
| Pinterest | very low | ✕ effectively none | 🔴 foreign advertisers only → useless |
| Snapchat | near-zero (low Asia preference) | ✕ | 🔴 useless |

## Activation gate (when this leaves backlog)

1. initial-setup resolves the consumer's **target market (geo) + persona vertical**.
2. If a candidate's activation condition matches (e.g. persona = B2B → LinkedIn; vertical = visual commerce + US/EU → Pinterest), add that source for that consumer **only**.
3. Each new source needs: a `flows/<source>/` flow + the `source` enum extended in the collection schema + STOP-on-block / public-front-door whitelist parity with existing flows.
4. No candidate is added globally or by default. Absence of a matching market/persona = source stays off.

## Sources (analysis basis)

- Ad-library inventory across platforms: [draph.ai — Ad Library Overview by Platform](https://draph.ai/best_ad_library_sites/), [Exploring Ad Libraries Across Platforms (Hamid Pasha)](https://www.hamidpasha.ca/post/exploring-ad-libraries-across-major-advertising-platforms), [LinkedIn Ad Library (LinkedIn Engineering)](https://www.linkedin.com/blog/engineering/trust-and-safety/enhancing-transparency-with-linkedins-ad-library)
- KR platform penetration: [Digital 2025: South Korea (DataReportal)](https://datareportal.com/reports/digital-2025-south-korea), [Social Media in South Korea 2026 (InterAd)](https://www.interad.com/en/insights/social-media-korea)
- Google Display global reach: [Google Display Ads reach (Google Blog)](https://blog.google/products/ads-commerce/boosting-your-reach-and-performance-with-google-display-ads/)
