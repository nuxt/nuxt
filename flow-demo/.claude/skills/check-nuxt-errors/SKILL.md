---
name: check-nuxt-errors
description: >
  TRIGGER after every browser interaction (agent-browser open/click/fill/snapshot)
  or when inspecting server/client logs in a Nuxt project.
  Checks for NUXT_ warnings and errors and fixes them before proceeding.
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - WebFetch
---

# Check & Fix Nuxt Errors

After any browser interaction or log inspection, proactively check for Nuxt errors.

## Steps

1. **Collect logs**: Check both the dev server output and the client console (`agent-browser console`).
2. **Search for `NUXT_`**: Scan all log output for messages containing `NUXT_` — these are warnings and errors that **must always be fixed**, even if they are pre-existing, unrelated to the current task, or appear to come from other code.
3. **Fix one by one**: Starting from the first error:
   - If a `See:` URL is present, use `WebFetch` to get the error documentation.
   - Use the diagnostic context (file paths, component/plugin names) to locate the problematic code. If no path is given, grep using identifiers from the error message.
   - Apply the fix suggestion from the error output first, then docs guidance. Run shell commands directly when needed (e.g. `npx nuxi module add`).
   - Re-check logs after each fix — later errors often cascade from earlier ones.
4. **Gate progress**: Do not proceed to the next task step until all `NUXT_` messages are resolved.

## Report

After fixing, state concisely: error code fixed, root cause, what changed.
