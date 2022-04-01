export default {
  /** @version 3 */
  experimental: {
    /**
     * Set to true to generate an async entrypoint for the Vue bundle (for module federation support).
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
    reactivityTransform: false
  }
}
