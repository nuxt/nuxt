import { createUnplugin } from 'unplugin'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../utils'

export const AsyncContextInjectionPlugin = (_nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:vue-async-context',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform (code) {
      if (!code.includes('_withAsyncContext')) {
        return
      }
      // TODO: Use parser
      const newCode = code.replace(
        'import { withAsyncContext as _withAsyncContext } from \'vue\'',
        'import { withAsyncContext as _withAsyncContext } from \'#app\''
      )
      if (code === newCode) {
        return
      }
      return {
        code: newCode,
        map: null
      }
    }
  }
})
