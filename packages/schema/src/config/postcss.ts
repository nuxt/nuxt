import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  postcss: {
    /**
     * A strategy for ordering PostCSS plugins.
     *
     * @type {'cssnanoLast' | 'autoprefixerLast' | 'autoprefixerAndCssnanoLast' | string[] | ((names: string[], presets: Record<string, (plugins: string[]) => string[]>) => string[])}
     */
    order: 'autoprefixerAndCssnanoLast',
    /**
     * Options for configuring PostCSS plugins.
     *
     * https://postcss.org/
     * @type {Record<string, any> & { autoprefixer?: any; cssnano?: any }}
     */
    plugins: {
      /**
       * https://github.com/postcss/autoprefixer
       */
      autoprefixer: {},

      /**
       * https://cssnano.github.io/cssnano/docs/config-file/#configuration-options
       */
      cssnano: {
        $resolve: async (val, get) => {
          if (val || val === false) {
            return val
          }
          if (await get('dev')) {
            return false
          }
          return {}
        },
      },
    },
  },
})
