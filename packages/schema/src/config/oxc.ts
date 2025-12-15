import { defineResolvers } from '../utils/definition.ts'

export default defineResolvers({
  /**
   * Configure shared oxc options used within Nuxt and passed where necessary.
   */
  oxc: {
    /**
     * Options for `oxc-transform`
     * @see [Oxc transform docs](https://oxc.rs/docs/guide/usage/transformer.html)
     */
    transform: {
      options: {
        target: {
          $resolve: async (val, get) => {
            if (typeof val === 'string') {
              return val
            }
            // https://github.com/vitejs/vite-plugin-vue/issues/528
            const useDecorators = await get('experimental').then(
              r => r?.decorators === true,
            )
            if (useDecorators) {
              return 'es2024'
            }
            return 'esnext'
          },
        },
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
      },
    },
  },
})
