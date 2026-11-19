import { createUnplugin } from 'unplugin'
import { generateTransform, rolldownString } from 'rolldown-string'

import { VUE_FILE_RE, vitestCacheKey } from '../../core/utils/index.ts'
import { assignDefaultExportName } from '../../components/utils.ts'
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
    vite: vitestCacheKey(({ id }) => getPageNames().get(id)),
    transform: {
      filter: {
        // Only the component module itself carries the page name; the macro and SFC block requests
        // are handled by their own transforms.
        id: { include: VUE_FILE_RE },
      },
      handler (code, id, meta?: unknown) {
        const pageName = getPageNames().get(id)
        if (!pageName) {
          return
        }

        const s = rolldownString(code, id, meta)
        assignDefaultExportName(code, id, s, pageName)
        if (!s.hasChanged()) {
          return
        }

        return generateTransform(s, id)
      },
    },
  }
})
