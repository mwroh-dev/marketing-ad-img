# Lazy-loaded detail images: must real-click "expand" + scroll before collecting

**Symptom**: Collecting a product/detail page yields only a fraction of its images (e.g. ~25) when the full page has many more (100+). Page-`innerText`-based extraction of reviews/copy also returns noise — product-description and keyword lines mixed in with the real signal.

**Root cause**: Detail images below the fold are lazy-loaded; they don't exist in the DOM until an "expand detail" control is really clicked and the page is scrolled. And `innerText` of the whole page concatenates unrelated sections, so structured signal (reviews) gets diluted by surrounding text.

**Rule**: Before collecting detail images, perform the real click on the "expand/see-more" control and scroll the section so lazy content loads, then collect. Extract structured records (e.g. reviews) from their specific DOM item nodes — not from whole-page text — and paginate deeply enough that frequency-based signal is trustworthy. STOP on any verification/bot-wall (no bypass).
