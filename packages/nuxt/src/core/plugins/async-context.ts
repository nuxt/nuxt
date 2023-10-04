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
          return withVueAsyncContext(() => {
            let nuxtApp
            try { nuxtApp = useNuxtApp() } catch {}
            return nuxtApp ? nuxtApp.runWithContext(fn) : fn()
          })
        }
      `.trim()
    },
    transform (code) {
      if (!code.includes('_withAsyncContext')) {
        return
      }
      // TODO
      code = `import { withAsyncContext as _withAsyncContext } from "${virtualFileId}";${code.replace(/withAsyncContext as _withAsyncContext,?/g, '')}`
      return {
        code,
        map: null
      }
    }
  }
})
