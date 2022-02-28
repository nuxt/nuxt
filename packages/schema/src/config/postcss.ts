import defu from 'defu'
import createResolver from 'postcss-import-resolver'

export default {
  /** @version 3 */
  postcss: {
    /** Path to postcss config file. */
    /** @type string | false */
    config: false,
    /**
     * Options for configuring PostCSS plugins.
     *
     * https://postcss.org/
     * @type {Record<string, any>}
     */
    plugins: {
      /**
       * https://github.com/postcss/postcss-import
       */
      'postcss-import': {
        $resolve: (val, get) => val !== false ? defu(val || {}, {
          resolve: createResolver({
            alias: { ...get('alias') },
            modules: [
              get('srcDir'),
              get('rootDir'),
              ...get('modulesDir')
            ]
          })
        }) : val,
      },

      /**
       * https://github.com/postcss/postcss-url
       */
      'postcss-url': {},

      /**
       * https://github.com/postcss/autoprefixer
       */
      autoprefixer: {},

      cssnano: {
        $resolve: (val, get) => val ?? (get('dev') && {
          preset: ['default', {
            // Keep quotes in font values to prevent from HEX conversion
            // https://github.com/nuxt/nuxt.js/issues/6306
            minifyFontValues: { removeQuotes: false }
          }]
        })
      }
    }
  }
}
