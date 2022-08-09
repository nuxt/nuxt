export default {
  /** @version 3 */
  experimental: {
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: (val, get) => val ?? (get('dev') && get('experimental.viteNode')) ?? false
    },

    /**
     * Use vite-node for on-demand server chunk loading
     */
    viteNode: process.env.EXPERIMENTAL_VITE_NODE ? true : false,

    /**
     * Enable Vue's reactivity transform
     * @see https://vuejs.org/guide/extras/reactivity-transform.html
     */
    reactivityTransform: false,

    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when build
     * @see https://github.com/nuxt/framework/issues/4084
     */
    externalVue: false,

    /**
     * Tree shakes contents of client-only components from server bundle
     * @see https://github.com/nuxt/framework/pull/5750
     */
    treeshakeClientOnly: false,

    /**
     * Split server bundle into multiple chunks and dynamically import them
     *
     *
     * @see https://github.com/nuxt/framework/issues/6432
     */
     viteServerDynamicImports: true,
  }
}
