import { bundle } from '@nuxt/nasti-builder'

// M0 smoke fixture. Uses the object builder form so it works without the
// package being resolvable by name; `builder: '@nuxt/nasti-builder'` also works
// at runtime (Nuxt's loadBuilder importModule resolves the workspace package).
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  builder: { bundle },
})
