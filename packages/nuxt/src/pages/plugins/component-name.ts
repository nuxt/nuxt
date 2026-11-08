import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'
import { parseAndWalk } from 'oxc-walker'

import { VUE_ID_FILTER, parseModuleId } from '../../core/utils/index.ts'
import { getPageComponentNames } from '../utils.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'

interface PageComponentNamePluginOptions {
  nuxt: Nuxt
}

/**
 * Sets the `__name` of page components to their route name inside the page module, so the route
 * table can load pages without assigning the name at runtime.
 */
export const PageComponentNamePlugin = (options: PageComponentNamePluginOptions) => createUnplugin(() => {
  let appPages: Array<NuxtPage[] | undefined> = []
  let pageNames = new Map<string, string | undefined>()

  function getPageNames () {
    const current = Object.values(options.nuxt.apps).map(app => app.pages)
    if (current.length !== appPages.length || current.some((pages, i) => pages !== appPages[i])) {
      appPages = current
      pageNames = getPageComponentNames(current.flatMap(pages => pages ?? []), options.nuxt)
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
