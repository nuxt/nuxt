This is a Nuxt project.

- ALWAYS run the dev server in background with `pnpm run dev 2>&1` for code changes
- ALWAYS verify UI features you add with `agent-browser`
- After every browser interaction, check both the server output and client console (`agent-browser console`) for errors/warnings
- Search for messages with `NUXT_` in logs because these are warnings and errors that should always be fixed, **even if they are not related to your task**

