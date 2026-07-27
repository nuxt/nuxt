import type { App } from 'vue'
import type { SSRContext } from 'vue-bundle-renderer/runtime'

/**
 * Signature matches `vue-bundle-renderer`'s `CreateApp<App<Element>>` so it can
 * be passed to `createRenderer()` without a cast.
 */
const stub: (ssrContext: SSRContext) => Promise<App> = () => {
  throw new Error('[nuxt] nuxt/entry was not replaced by a builder. Ensure a Nuxt builder (Vite, Webpack, or Rspack) is configured.')
}

export default stub
