import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  postcss: {
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
       * https://cssnano.co/docs/config-file/#configuration-options
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
        }
      }
    }
  }
})
