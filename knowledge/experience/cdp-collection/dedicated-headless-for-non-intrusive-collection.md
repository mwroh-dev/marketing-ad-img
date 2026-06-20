# Use a dedicated headless Chrome to satisfy non-intrusive + rendering at once

**Symptom**: Sharing the user's running Chrome for automation forces a lose-lose: a background tab never paints (so byte/screenshot capture hangs), while bringing the tab to the foreground steals the user's cursor/focus (intrusive). Killed runs also leave orphan tabs that pile up and slow Chrome until it hangs.

**Root cause**: One browser instance can't be both "rendering" and "not stealing focus" when work happens in a shared session. Background tabs don't paint; foregrounding intrudes.

**Rule**: Run collection in a dedicated headless Chrome (own port and own `--user-data-dir`). With no window there is no focus to steal, yet pages still render, so capture works while the user keeps working. Always close automation tabs in a `finally` with a hard timeout even on failure, and sweep orphans via `/json/close` — never leave tabs open. (Login-gated sources still require a human-logged-in profile; this pattern is for the non-intrusive/rendering tradeoff, not for bypassing auth.)
