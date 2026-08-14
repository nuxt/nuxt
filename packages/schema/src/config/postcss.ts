import { defineResolvers } from '../utils/definition.ts'
import { schemaDiagnostics } from '../diagnostics.ts'

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
            throw schemaDiagnostics.NUXT_B5015({ preset: val })
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
      autoprefixer: {
        $resolve: async (val, get) => {
          if (val || val === false) {
            return val
          }
          return (await get('future.compatibilityVersion')) >= 5 ? false : {}
        },
      },
      cssnano: {
        $resolve: async (val, get) => {
          if (val || val === false) {
            return val
          }
          if (await get('dev') || (await get('future.compatibilityVersion')) >= 5) {
            return false
          }
          return {}
        },
      },
    },
  },
})
