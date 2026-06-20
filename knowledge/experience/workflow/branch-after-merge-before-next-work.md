# Switch to a new branch right after merging — don't pile next work onto the default branch

**Symptom**: After merging a feature branch into the default branch via local merge, work continues *in place* on the default branch, accumulating many commits directly there. A later "merge it in" request is a no-op because the work is already on the default branch.

**Root cause**: A local-merge finish leaves you sitting on the default branch. Starting the next task from there silently accumulates commits on default, with no feature branch — violating the "if on the default branch, branch first" rule.

**Rule**: Immediately after a merge, before starting any new work, switch to a fresh feature branch (`git checkout -b <next>`). When asked to "merge," first check actual branch state (ahead/behind); if the work is already integrated, say so plainly and clean up stale branches by fast-forward — never report a fake "merged" for a no-op.
