import { defineUntypedSchema } from 'untyped'

const ensureItemIsLast = (item: string) => (arr: string[]) => {
  const index = arr.indexOf(item)
  if (index !== -1) {
    arr.splice(index, 1)
    arr.push(item)
  }
  return arr
}

const orderPresets = {
  cssnanoLast: ensureItemIsLast('cssnano'),
  autoprefixerLast: ensureItemIsLast('autoprefixer'),
  autoprefixerAndCssnanoLast (names: string[]) {
    return orderPresets.cssnanoLast(orderPresets.autoprefixerLast(names))
  },
}

export default defineUntypedSchema({
  postcss: {
    /**
     * A strategy for ordering PostCSS plugins.
     *
     * @type {'cssnanoLast' | 'autoprefixerLast' | 'autoprefixerAndCssnanoLast' | string[] | ((names: string[]) => string[])}
     */
    order: {
      $resolve: (val: string | string[] | ((plugins: string[]) => string[])): string[] | ((plugins: string[]) => string[]) => {
        if (typeof val === 'string') {
          if (!(val in orderPresets)) {
            throw new Error(`[nuxt] Unknown PostCSS order preset: ${val}`)
          }
          return orderPresets[val as keyof typeof orderPresets]
        }
        return val ?? orderPresets.autoprefixerAndCssnanoLast
      },
    },
    /**
     * Options for configuring PostCSS plugins.
     *
     * https://postcss.org/
     * @type {Record<string, unknown> & { autoprefixer?: typeof import('autoprefixer').Options; cssnano?: typeof import('cssnano').Options }}
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
