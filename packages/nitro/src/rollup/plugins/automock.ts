import consola from 'consola'
import { normalize } from 'upath'

const internalRegex = /^\.|\?|\.[mc]?js$|.ts$|.json$/

export function autoMock () {
  return {
    name: 'auto-mock',
    resolveId (src: string) {
      if (src && !internalRegex.test(src)) {
        consola.warn('Auto mock external ', src)
        return {
          id: normalize(require.resolve('unenv/runtime/mock/proxy'))
        }
      }
      return null
    }
  }
}
