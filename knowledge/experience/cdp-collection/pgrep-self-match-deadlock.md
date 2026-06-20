# Background watcher's `pgrep -f` self-matches its own wrapper → deadlock

**Symptom**: A watcher that polls `until ! pgrep -f "<script> <args>"; do ...` waits forever even after the target process exits. Multiple such watchers deadlock for tens of minutes; downstream stages never start.

**Root cause**: `pgrep -f` matches the full command line. The watcher itself runs inside a shell wrapper (e.g. `zsh -c "...<script> <args>..."`) whose command line *contains the very string being searched for*, so `pgrep` always finds at least one match (itself). The `until ! pgrep` condition can never become true.

**Rule**: Do not poll for process liveness with a `pgrep -f` pattern that overlaps the watcher's own command line. Prefer eliminating the poll entirely: run the dependent steps as a single synchronous blocking chain (`run job (blocking) → assemble → score → verify`) and use exit codes instead of polling. If a watcher is unavoidable, match on the bare binary (e.g. node) or a PID file — never on a substring the watcher itself carries.
