# Global Image Prompt Principles

Provider-neutral. No brand, product, or category specifics belong here.

---

## Prompt Structure

A well-formed image prompt addresses these layers in order:

1. **Subject** — what is the primary element and its key attributes.
2. **Action / state** — what the subject is doing or how it is positioned.
3. **Environment** — setting, background, lighting conditions.
4. **Style** — visual language (photographic, illustrative, etc.) and mood.
5. **Technical spec** — aspect ratio, resolution intent, format.
6. **Exclusions** — what to omit ("no text overlay", "no human hands visible").

---

## Korean Text Rendering

When Korean text must appear in the image:
- Provide the exact Korean string character-by-character. Do not paraphrase or summarize.
- State explicitly: "render the following Korean text exactly as written."
- Specify font weight and placement within the image frame.
- Note: AI image models frequently hallucinate or corrupt CJK text. Always include a validation
  step that checks rendered text against the source string before using the asset.

---

## Common Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Distorted Korean text | Model approximates glyphs | Explicit instruction + post-render OCR check |
| Wrong focal point | Subject underspecified | Name position explicitly ("centered", "left third") |
| Cluttered background | No exclusions stated | Add explicit "clean background" or describe what is present |
| Inconsistent lighting | Multiple implicit light sources | Name one primary light source and direction |

---

## Provider-Neutral Constraints

- Avoid prompts that imply real people or recognizable locations unless cleared.
- Prompts that embed product claims carry the same evidence burden as copy claims.
- Keep prompt length proportional to complexity; padding does not improve output.
