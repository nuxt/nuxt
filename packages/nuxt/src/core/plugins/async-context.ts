import { createUnplugin } from 'unplugin'
import MagicString from 'magic-string'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../utils'

export const AsyncContextInjectionPlugin = (nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:vue-async-context',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform: {
      filter: {
        code: { include: /_withAsyncContext/ },
      },
      handler (code) {
        const s = new MagicString(code)
        s.prepend('import { withAsyncContext as _withAsyncContext } from "#app/composables/asyncContext";\n')
        s.replace(/withAsyncContext as _withAsyncContext,?/, '')
        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server
              ? s.generateMap({ hires: true })
              : undefined,
          }
        }
      },
    },
  }
})
