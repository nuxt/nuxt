import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  router: {
    /**
     * Additional options passed to `vue-router`.
     *
     * Note: Only JSON serializable options should be passed by nuxt config.
     *
     * For more control, you can use `app/router.options.ts` file.
     *
     * @see [documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
     * @type {import('../src/types/router').RouterConfigSerializable}
     *
     */
    options: {},
    /**
     * The string used as separator between nested routes.
     * `parent/[slug].vue` will be converted to `parent-slug` where `'-'` is the separator by default.
     */
    routeSeparator: '-',
  }
})
