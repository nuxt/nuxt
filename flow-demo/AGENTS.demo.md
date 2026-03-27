This is a Nuxt project.

- Run the dev server in background with `pnpm run dev 2>&1`, read the output for errors/warnings, and fix them one at a time
- Verify features you add with agent-browser
- After every browser interaction, check both the server output and client console (`agent-browser console`) for errors/warnings
- Search for messages with `NUXT_` in logs because these are warnings and errors that should always be fixed, even if they are not related to the current task. If you see any of these, fix them, one by one, before proceeding to the next step.

