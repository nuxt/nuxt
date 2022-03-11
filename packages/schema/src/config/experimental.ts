export default {
  /**
   * Set to true to generate an async entrypoint for the Vue bundle (for module federation support).
   * @version 3
   */
  asyncEntry: false,

  /**
   * Use vite-node for on-demand server chunk loading
   * @version 3
   */
  viteNode: process.env.EXPERIMENTAL_VITE_NODE ? true : false
}
