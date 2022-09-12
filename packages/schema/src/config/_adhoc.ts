import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
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
    $resolve: (val) => {
      if (Array.isArray(val)) {
        return { dirs: val }
      }
      if (val === undefined || val === true) {
        return { dirs: [{ path: '~/components/global', global: true }, '~/components'] }
      }
      return val
    }
  },

  /** @deprecated Please use `imports` config. */
  autoImports: null,

  /**
   * Configure how Nuxt auto-imports composables into your application.
   *
   * @see [Nuxt 3 documentation](https://v3.nuxtjs.org/guide/directory-structure/composables)
   * @type {typeof import('../src/types/imports').ImportsOptions}
   * @version 3
   */
  imports: {
    global: false,
    dirs: []
  },

  /**
   * Whether to use the vue-router integration in Nuxt 3. If you do not provide a value it will be
   * enabled if you have a `pages/` directory in your source folder.
   *
   * @type {boolean}
   * @version 3
   */
  pages: undefined,

  /**
   * Manually disable nuxt telemetry.
   *
   * @see [Nuxt Telemetry](https://github.com/nuxt/telemetry) for more information.
   *
   * @type {boolean}
   * @version 3
  */
  telemetry: undefined
})
