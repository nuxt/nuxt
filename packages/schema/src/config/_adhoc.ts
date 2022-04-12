export default {
  /**
   * Configure Nuxt component auto-registration.
   *
   * Any components in the directories configured here can be used throughout your
   * pages, layouts (and other components) without needing to explicitly import them.
   *
   * @default {{ dirs: [`~/components`] }}
   * @see [Nuxt 3](https://v3.nuxtjs.org/guide/directory-structure/components) and
   * [Nuxt 2](https://nuxtjs.org/docs/directory-structure/components/) documentation
   * @type {boolean | typeof import('../src/types/components').ComponentsOptions | typeof import('../src/types/components').ComponentsOptions['dirs']}
   * @version 2
   * @version 3
   */
  components: {
    $resolve: (val, get) => {
      if (Array.isArray(val)) {
        return { dirs: val }
      }
      if (val === undefined || val === true) {
        return { dirs: ['~/components'] }
      }
      return val
    }
  },

  /**
   * Configure how Nuxt auto-imports composables into your application.
   *
   * @see [Nuxt 3 documentation](https://v3.nuxtjs.org/guide/directory-structure/composables)
   * @type {typeof import('../src/types/imports').AutoImportsOptions}
   * @version 3
   */
  autoImports: {
    global: false,
    dirs: []
  },
}
