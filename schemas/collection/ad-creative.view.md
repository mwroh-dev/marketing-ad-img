<!-- GENERATED from ad-creative.ts — the contract your output must match; regenerate via schemas/build.ts -->
```ts
// objects are CLOSED — emit only the fields shown, no extras. `?` = optional. (validated against the .schema.json)
// per-persona set of real ad creatives collected from a public ad library
ad-creative = {
  persona_id: string  // non-empty
  product_id?: string
  advertiser?: string
  source: "meta_ad_library"|"google_ads_transparency"|"tiktok_creative_center"|"own_detail_cut"
  search: {
    mode: "advertiser"|"keyword"|"detail_cut"
    query: string
    category?: string
    country?: string
  }
  creatives: {
    library_id?: string
    image_url?: string
    image_file?: string
    ad_copy?: string
    platforms?: string[]
    keywords?: string[]  // every search keyword whose results surfaced this ad (preserved across the global dedup)
    started_at?: string
    subtype: "single_image"|"carousel"|"video_thumb"|"video"
    advertiser_id?: string
    resolved_via?: "advertiser"|"advertiser_loose"|"text_fallback"
    matched_name?: string
    match_quality?: "exact"|"prefix"|"loose"
    type?: "ad_creative"|"catalog"|"spec"|"review"|"lifestyle"|"unknown"  // the ad-creative-refiner's TYPE classification
    confidence?: number /*0..1*/
    competitor_id?: string
    video_url?: string
    video_file?: string
    video_duration?: string
    follower_count?: int /*0..*/|null
    status?: "active"|"inactive"|"unknown"
    page_category?: string
    page_id?: string
    detail_captured?: boolean
    advertiser_name?: string
  }[]
  queries?: {
    mode: "advertiser"|"keyword"
    query: string
  }[]
  coverage_flags?: string[]
  blocked?: boolean
  captured_at?: string
}
```
