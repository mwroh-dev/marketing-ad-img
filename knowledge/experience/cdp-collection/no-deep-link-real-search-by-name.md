# Deep-link URL entry trips the bot-wall → enter by real search-then-click

**Symptom**: Navigating straight to a known product/result URL (`gotoRoot(target.url)`) intermittently lands on a site error page ("service unavailable / too many concurrent users / network unstable / system error"). Entering the *same* target by typing its name into the site's search box and clicking the result is not blocked.

**Root cause**: Direct URL deep-linking lacks the referrer/redirect chain a real search produces, so the site treats it as bot traffic and serves an error wall. Worse, if the block detector doesn't include the site's localized error phrases, it fails to STOP and extracts the error page as if it were real content.

**Rule**: Enter every target by real search → click the result (the same redirect/referrer path a human takes). Never assemble or navigate to result/pagination deep-link URLs; keep `target.url` only as a reference/dedup key. Add the site's localized block phrases to the block detector and re-check `isBlocked` immediately after the search lands; STOP on block (no hackier workaround).
