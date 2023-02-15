import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  experimental: {
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: (val) => val ?? false
    },

    /**
     * Enable Vue's reactivity transform
     * @see https://vuejs.org/guide/extras/reactivity-transform.html
     */
    reactivityTransform: false,

    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when building.
     * @see https://github.com/nuxt/nuxt/issues/13632
     */
    externalVue: true,

    /**
     * Tree shakes contents of client-only components from server bundle.
     * @see https://github.com/nuxt/framework/pull/5750
     */
    treeshakeClientOnly: true,

    /**
     * Emit `app:chunkError` hook when there is an error loading vite/webpack
     * chunks.
     *
     * You can set this to `reload` to perform a hard reload of the new route
     * when a chunk fails to load when navigating to a new route.
     *
     * @see https://github.com/nuxt/nuxt/pull/19038
     * @type {boolean | 'reload'}
     */
    emitRouteChunkError: false,

    /**
     * Use vite-node for on-demand server chunk loading
     *
     * @deprecated use `vite.devBundler: 'vite-node'`
     */
    viteNode: {
      $resolve: (val) => {
        val = process.env.EXPERIMENTAL_VITE_NODE ? true : val
        if (val === true) {
          console.warn('`vite-node` is now enabled by default. You can safely remove `experimental.viteNode` from your config.')
        } else if (val === false) {
          console.warn('`vite-node` is now enabled by default. To disable it, set `vite.devBundler` to `legacy` instead.')
        }
        return val ?? true
      }
    },

    /**
     * Split server bundle into multiple chunks and dynamically import them.
     *
     * @see https://github.com/nuxt/nuxt/issues/14525
     */
    viteServerDynamicImports: true,

    /**
     * Inline styles when rendering HTML (currently vite only).
     *
     * You can also pass a function that receives the path of a Vue component
     * and returns a boolean indicating whether to inline the styles for that component.
     *
     * @type {boolean | ((id?: string) => boolean)}
     */
    inlineSSRStyles: {
      async $resolve(val, get) {
        if (val === false || (await get('dev')) || (await get('ssr')) === false || (await get('builder')) === '@nuxt/webpack-builder') {
          return false
        }
        // Enabled by default for vite prod with ssr
        return val ?? true
      }
    },

    /**
     * Turn off rendering of Nuxt scripts and JS resource hints.
     */
    noScripts: false,

    /**
     * When this option is enabled (by default) payload of pages generated with `nuxt generate` are extracted
     */
    payloadExtraction: {
      async $resolve(enabled, get) {
        enabled = enabled ?? false
        if (enabled) {
          console.warn('Using experimental payload extraction for full-static output. You can opt-out by setting `experimental.payloadExtraction` to `false`.')
        }
        return enabled
      }
    },

    /** Enable cross-origin prefetch using the Speculation Rules API. */
    crossOriginPrefetch: false,

    /**
     * Write early hints when using node server.
     *
     * @note nginx does not support 103 Early hints in the current version.
     */
    writeEarlyHints: false,

    /**
     * Experimental component islands support with <NuxtIsland> and .island.vue files.
     */
    componentIslands: false,

    /**
     * Enable experimental config schema support
     *
     * @see https://github.com/nuxt/nuxt/issues/15592
     */
    configSchema: false
  }
})
