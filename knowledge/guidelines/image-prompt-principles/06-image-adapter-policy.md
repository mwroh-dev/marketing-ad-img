# 06. Image Adapter Policy

## Scope

MVP image adapters do not call real image providers.

They produce provider-specific prompt artifacts only.

## Providers

```txt
chatgpt_image
gemini_image
```

Claude is the execution environment, not an image provider target in the MVP.

## Provider-neutral Spec

All adapters consume the same `CreativeCandidateSpec`.

```json
{
  "candidate_id": "candidate_001",
  "format": "meta_feed_4_5",
  "canvas": {
    "ratio": "4:5",
    "width": 1080,
    "height": 1350
  },
  "product": {
    "asset_id": "product_001_cutout",
    "placement": "center_hero",
    "scale": "large"
  },
  "copy": {
    "language": "ko",
    "headline": "...",
    "subcopy": "...",
    "cta": "..."
  },
  "layout": {
    "headline_position": "top",
    "product_position": "center",
    "cta_position": "bottom",
    "text_density": "low"
  },
  "style": {
    "brand_mood": "...",
    "color_direction": "...",
    "avoid": []
  }
}
```

## Adapter Output

Each adapter outputs:

```json
{
  "adapter_id": "chatgpt_image",
  "provider": "chatgpt",
  "candidate_id": "candidate_001",
  "prompt": "...",
  "negative_prompt": "...",
  "provider_notes": "...",
  "input_assets": [],
  "expected_output": {},
  "verification_checklist": [],
  "retry_instruction_template": "..."
}
```

## Korean Text Rendering

Korean copy must be rendered directly by the image model.

Therefore adapter output must include:

- exact headline text
- exact subcopy text
- exact CTA text
- warning not to alter Korean text
- checklist for detecting broken Korean text

## Verification Checklist Requirements

Checklist must include:

- Korean headline rendered exactly
- Korean subcopy rendered exactly or intentionally omitted by spec
- CTA rendered exactly
- product visible and undistorted
- layout follows requested ratio
- text remains readable
- no unsupported claim appears
- no competitor asset is copied
- brand tone preserved
