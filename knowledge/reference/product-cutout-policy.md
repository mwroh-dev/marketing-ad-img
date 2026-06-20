# 07. Product Cutout Policy

## Scope

Since a product cutout PNG may not exist, the product cutout/cleanup script is included from the start.

Implementation language: Node.

No Python dependency in initial scaffold.

## Script

```txt
${CLAUDE_PLUGIN_ROOT}/shared/harness/product-cutout-cleanup.ts
```

## Input

```json
{
  "source_image_path": "assets/product-images/raw/product_001.jpg",
  "product_id": "product_001",
  "output_dir": "assets/product-images/cutout/",
  "cleanup_options": {
    "background_mode": "auto",
    "edge_refine": true,
    "alpha_cleanup": true,
    "center_crop": true,
    "preview": true
  }
}
```

## Output

```txt
cutout.png
preview.png
mask.png
cleanup-report.json
```

## cleanup-report.json

```json
{
  "product_id": "product_001",
  "source_image_path": "...",
  "cutout_path": "...",
  "preview_path": "...",
  "status": "passed",
  "quality": {
    "transparent_alpha": true,
    "min_resolution": true,
    "edge_cleanup": "passed",
    "background_residue": "low",
    "product_centered": true
  },
  "warnings": []
}
```

## Quality Gate

A cutout asset is usable only when:

- transparent PNG exists
- alpha channel is valid
- minimum resolution is satisfied
- product is not over-cropped
- edge cleanup is acceptable
- background residue is not severe
- preview image is generated

## Registry

`.generate-ads-img/registry/product-assets.yaml` must reference both raw and cutout assets.
