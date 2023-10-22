import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  postcss: {
    /**
     * Options for configuring PostCSS plugins.
     *
     * https://postcss.org/
     * @type {Record<string, any>}
     */
    plugins: {
      /**
       * https://github.com/postcss/autoprefixer
       */
      autoprefixer: {},

      cssnano: {
        $resolve: async (val, get) => val ?? !(await get('dev') && {
          preset: ['default', {
            // Keep quotes in font values to prevent from HEX conversion
            // https://github.com/nuxt/nuxt/issues/6306
            minifyFontValues: { removeQuotes: false }
          }]
        })
      }
    }
  }
})
