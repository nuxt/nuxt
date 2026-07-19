import type { NuxtPage } from 'nuxt/schema'
import { withMatrix } from '../../matrix'

export default withMatrix({
  modules: [
    function (_options, nuxt) {
      const routesToDuplicate = ['/async-parent']
      const stripLayout = (page: NuxtPage): NuxtPage => ({
        ...page,
        children: page.children?.map(child => stripLayout(child)),
        name: 'internal-' + page.name,
        path: page.path.replace(/^\//, ''),
        meta: {
          ...page.meta,
          layout: undefined,
          _layout: page.meta?.layout,
        },
      })
      nuxt.hook('pages:resolved', (pages) => {
        const newPages = []
        for (const page of pages) {
          if (routesToDuplicate.includes(page.path)) {
            newPages.push(stripLayout(page))
          }
        }
        const internalParent = pages.find(page => page.path === '/internal-layout')
        internalParent!.children = newPages
      })
    },
  ],
  app: {
    pageTransition: true,
    layoutTransition: true,
    head: {
      title: 'Nested Suspense',
      meta: [{ name: 'description', content: 'Nested suspense test fixture' }],
    },
  },
  routeRules: {
    '/hydration/spa-redirection/**': { ssr: false },
  },
})
