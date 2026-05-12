import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../utils/index.ts'

const WITH_ASYNC_CONTEXT_IMPORT_RE = /withAsyncContext as _withAsyncContext,?/

export const AsyncContextInjectionPlugin = (_nuxt: Nuxt) => createUnplugin(() => {
  return {
    name: 'nuxt:vue-async-context',
    transformInclude (id) {
      return isVue(id, { type: ['template', 'script'] })
    },
    transform: {
      filter: {
        code: { include: /_withAsyncContext/ },
      },
      handler (code, id, meta?: unknown) {
        const s = rolldownString(code, id, meta)
        s.prepend('import { withAsyncContext as _withAsyncContext } from "#app/composables/asyncContext";\n')
        const match = WITH_ASYNC_CONTEXT_IMPORT_RE.exec(code)
        if (match) {
          s.remove(match.index, match.index + match[0].length)
        }
        return generateTransform(s, id)
      },
    },
  }
})
