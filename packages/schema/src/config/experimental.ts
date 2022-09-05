import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /** @version 3 */
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
     * @see https://github.com/nuxt/framework/issues/4084
     */
    externalVue: true,

    /**
     * Tree shakes contents of client-only components from server bundle.
     * @see https://github.com/nuxt/framework/pull/5750
     */
    treeshakeClientOnly: false,

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
     * @see https://github.com/nuxt/framework/issues/6432
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
      $resolve (val, get) {
        if (val === false || get('dev') || get('ssr') === false || get('builder') === '@nuxt/webpack-builder') {
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
  }
})
