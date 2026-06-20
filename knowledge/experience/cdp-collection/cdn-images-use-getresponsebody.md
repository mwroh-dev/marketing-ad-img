# Downloading already-loaded CDN images: use CDP `getResponseBody`, not fetch/canvas/screenshot

**Symptom**: Trying to capture image bytes that the page already displays (CDN-hosted, e.g. `*.fbcdn.net`) fails every "obvious" way: in-page `fetch()` is CORS-blocked, Node `fetch` hangs, drawing to `<canvas>` taints it, and a background-tab screenshot never paints (so it also hangs).

**Root cause**: The image bytes are already in the browser's network cache, but CORS, canvas tainting, and background-tab non-painting all block the in-page/JS routes. The cached response bytes are reachable only through the debugging protocol.

**Rule**: Pull already-loaded image bytes with CDP `Network.getResponseBody` (cached bytes, immune to CORS and to whether the tab painted). Keep the `Network.responseReceived` handler enabled only on a dedicated instance — leaving it on during a heavy page load floods events and can drop the websocket. File-write success is not capture success; verify the bytes decode.
