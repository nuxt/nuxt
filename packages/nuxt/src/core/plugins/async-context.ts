import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import type { Nuxt } from '@nuxt/schema'
import { isVue } from '../utils/index.ts'

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
        s.replace(/withAsyncContext as _withAsyncContext,?/, '')
        return generateTransform(s, id)
      },
    },
  }
})
