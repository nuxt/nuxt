import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  router: {
    /**
     * Additional router options passed to `vue-router`. On top of the options for `vue-router`,
     * Nuxt offers additional options to customize the router (see below).
     * @note Only JSON serializable options should be passed by Nuxt config.
     * For more control, you can use `app/router.options.ts` file.
     * @see [documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
     * @type {typeof import('../src/types/router').RouterConfigSerializable}
     */
    options: {
      /**
       * You can enable hash history in SPA mode. In this mode, router uses a hash character (#) before
       * the actual URL that is internally passed. When enabled, the
       * **URL is never sent to the server** and **SSR is not supported**.
       * @type {typeof import('../src/types/router').RouterConfigSerializable['hashMode']}
       * @default false
       */
      hashMode: false,

      /**
       * Customize the scroll behavior for hash links.
       * @type {typeof import('../src/types/router').RouterConfigSerializable['scrollBehaviorType']}
       * @default 'auto'
       */
      scrollBehaviorType: 'auto'
    }
  }
})
