import { createUnplugin } from 'unplugin'
import type { Unimport } from 'unimport'
import { normalize } from 'pathe'
import { tryUseNuxt } from '@nuxt/kit'
import type { ImportsOptions } from 'nuxt/schema'

import { isJS, isVue } from '../core/utils'
import { installNuxtModule } from '../core/features'

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/
const IMPORTS_RE = /(['"])#imports\1/

export const TransformPlugin = ({ ctx, options, sourcemap }: { ctx: Unimport, options: Partial<ImportsOptions>, sourcemap?: boolean }) => createUnplugin(() => {
  return {
    name: 'nuxt:imports-transform',
    enforce: 'post',
    transformInclude (id) {
      // Included
      if (options.transform?.include?.some(pattern => pattern.test(id))) {
        return true
      }
      // Excluded
      if (options.transform?.exclude?.some(pattern => pattern.test(id))) {
        return false
      }

      // Vue files
      if (isVue(id, { type: ['script', 'template'] })) {
        return true
      }

      // JavaScript files
      return isJS(id)
    },
    async transform (code, id) {
      id = normalize(id)
      const isNodeModule = NODE_MODULES_RE.test(id) && !options.transform?.include?.some(pattern => pattern.test(id))
      // For modules in node_modules, we only transform `#imports` but not doing imports
      if (isNodeModule && !IMPORTS_RE.test(code)) {
        return
      }

      const { s, imports } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule })
      if (imports.some(i => i.from === '#app/composables/script-stubs') && tryUseNuxt()?.options.test === false) {
        installNuxtModule('@nuxt/scripts')
      }

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap
            ? s.generateMap({ hires: true })
            : undefined,
        }
      }
    },
  }
})
