import { defineResolvers } from '../utils/definition.ts'

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

export default defineResolvers({
  postcss: {
    order: {
      $resolve: (val) => {
        if (typeof val === 'string') {
          if (!(val in orderPresets)) {
            throw new Error(`[nuxt] Unknown PostCSS order preset: ${val}`)
          }
          return orderPresets[val as keyof typeof orderPresets]
        }
        if (typeof val === 'function') {
          return val as (names: string[]) => string[]
        }
        if (Array.isArray(val)) {
          return val
        }
        return orderPresets.autoprefixerAndCssnanoLast
      },
    },
    plugins: {
      autoprefixer: {},
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
