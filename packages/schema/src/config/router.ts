import { defineResolvers } from '../utils/definition'

export default defineResolvers({
  router: {
    /**
     * Additional router options passed to `vue-router`. On top of the options for `vue-router`,
     * Nuxt offers additional options to customize the router (see below).
     * @note Only JSON serializable options should be passed by Nuxt config.
     * For more control, you can use `app/router.options.ts` file.
     * @see [Vue Router documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
     */
    options: {
      /**
       * You can enable hash history in SPA mode. In this mode, router uses a hash character (#) before
       * the actual URL that is internally passed. When enabled, the
       * **URL is never sent to the server** and **SSR is not supported**.
       * @default false
       */
      hashMode: false,

      /**
       * Customize the scroll behavior for hash links.
       * @default 'auto'
       */
      scrollBehaviorType: 'auto',
    },
  },
})
