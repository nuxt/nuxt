import { createUnplugin } from 'unplugin'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../utils'

export const AsyncContextInjectionPlugin = (_nuxt: Nuxt) => createUnplugin(() => {
  const virtualFileId = '\0vue-async-context'
  return {
    name: 'nuxt:vue-async-context',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    resolveId (id) {
      if (id === virtualFileId) {
        return id
      }
    },
    load (id) {
      if (id !== virtualFileId) {
        return
      }
      return `
        import { withAsyncContext as withVueAsyncContext } from 'vue'
        import { useNuxtApp } from '#app'
        export function withAsyncContext(fn) {
          return withVueAsyncContext(() => useNuxtApp().runWithContext(fn))
        }
      `.trim()
    },
    transform (code) {
      // TODO
      const newCode = code.replace(
        "import { withAsyncContext as _withAsyncContext } from 'vue'",
        `import { withAsyncContext as _withAsyncContext } from "${virtualFileId}"`
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
