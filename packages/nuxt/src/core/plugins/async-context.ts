import { createUnplugin } from 'unplugin'
import type { Nuxt } from '@nuxt/schema'
import MagicString from 'magic-string'
import { isVue } from '../utils'

export const AsyncContextInjectionPlugin = (nuxt: Nuxt) => createUnplugin(() => {
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
        import { withAsyncContext as withVueAsyncContext, getCurrentInstance } from 'vue'
        export function withAsyncContext(fn) {
          return withVueAsyncContext(() => {
            const nuxtApp = getCurrentInstance()?.appContext.app.$nuxt
            return nuxtApp ? nuxtApp.runWithContext(fn) : fn()
          })
        }
      `.trim()
    },
    transform (code) {
      if (!code.includes('_withAsyncContext')) {
        return
      }
      const s = new MagicString(code)
      s.prepend(`import { withAsyncContext as _withAsyncContext } from "${virtualFileId}";\n`)
      s.replace(/withAsyncContext as _withAsyncContext,?/, '')
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap
            ? s.generateMap({ hires: true })
            : undefined
        }
      }
    }
  }
})
