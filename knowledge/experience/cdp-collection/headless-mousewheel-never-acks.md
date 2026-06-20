# Headless Chrome `mouseWheel` never acks → CDP call hangs forever

**Symptom**: A CDP automation that scrolls via `Input.dispatchMouseEvent({type:"mouseWheel"})` hangs indefinitely (minutes) on the scroll step. The page is rendered fine — not blocked, not a bot-wall — yet the `await` never resolves.

**Root cause**: `headless=new` Chrome does not acknowledge `Input.dispatchMouseEvent{type:"mouseWheel"}`, so the awaited CDP response is never returned and the call blocks the whole run. (Distinguish from a block: a block shows bot-wall text and the page state changes; a hang is one specific call that never returns while the page looks correct.)

**Rule**: In headless Chrome, never scroll with `mouseWheel`. Use a real JS page scroll — `window.scrollBy(...)` or `element.scrollIntoView()` — which actually scrolls the page (not a hacky DOM hack) and returns immediately. Also bound *every* CDP step with a per-step timeout so a single non-responding call can never stall the entire run; wrap each unit in try/catch to preserve partial results. Use step-timing instrumentation to tell "blocked" (bot-wall text) from "hang" (one call never returns).
