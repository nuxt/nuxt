import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { parseAndWalk } from 'oxc-walker'

import { VUE_ID_FILTER, parseModuleId } from '../../core/utils/index.ts'
import { getPageComponentNames } from '../utils.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'

interface PageComponentNamePluginOptions {
  nuxt: Nuxt
  getPages: () => NuxtPage[] | undefined
}

/**
 * Sets the `__name` of page components to their route name inside the page module, so the route
 * table can load pages without assigning the name at runtime.
 */
export const PageComponentNamePlugin = (options: PageComponentNamePluginOptions) => createUnplugin(() => {
  let pages: NuxtPage[] | undefined
  let pageNames = new Map<string, string | undefined>()

  function getPageNames () {
    const latest = options.getPages()
    if (latest !== pages) {
      pages = latest
      pageNames = latest ? getPageComponentNames(latest, options.nuxt) : new Map<string, string | undefined>()
    }
    return pageNames
  }

  return {
    name: 'nuxt:page-component-name-plugin',
    enforce: 'post',
    transform: {
      filter: {
        id: { include: VUE_ID_FILTER },
      },
      handler (code, id, meta?: unknown) {
        const { pathname, search } = parseModuleId(id)
        // Only the component module itself carries the page name; the macro and SFC block requests
        // are handled by their own transforms.
        if (search) {
          return
        }

        const pageName = getPageNames().get(pathname)
        if (!pageName) {
          return
        }

        const s = rolldownString(code, id, meta)
        parseAndWalk(code, id, function (node) {
          if (node.type !== 'ExportDefaultDeclaration') {
            return
          }
          const { start, end } = node.declaration
          s.overwrite(start, end, `Object.assign(${code.slice(start, end)}, { __name: ${JSON.stringify(pageName)} })`)
          this.skip()
        })
        if (!s.hasChanged()) {
          return
        }

        return generateTransform(s, id)
      },
    },
  }
})
