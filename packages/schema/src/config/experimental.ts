export default {
  /** @version 3 */
  experimental: {
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: (val, get) => val ?? false
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
     *
     * @see https://github.com/nuxt/framework/issues/6432
     */
    viteServerDynamicImports: true
  }
}
