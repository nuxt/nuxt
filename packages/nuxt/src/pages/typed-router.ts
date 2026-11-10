import { resolve } from 'pathe'
import type { EditableTreeNode, Options as TypedRouterOptions } from 'vue-router/unplugin'

import { relativizeToParent } from './utils.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'

interface TypedRouterContext {
  resolvePages: () => Promise<NuxtPage[]>
  /** Page paths as derived by unrouting, for pages whose path is overridden by `definePageMeta`. */
  originalPagePaths: WeakMap<NuxtPage, string>
}

/** Generate `types/typed-router.d.ts` from the resolved pages with `vue-router/unplugin`. */
export async function setupTypedRouter (nuxt: Nuxt, ctx: TypedRouterContext) {
  const declarationFile = resolve(nuxt.options.buildDir, 'types/typed-router.d.ts')

  function addPage (parent: EditableTreeNode, page: NuxtPage) {
    let insertedPath = page.path
    if (page.path[0] === '/') {
      // Nest a page with an absolute path (a top-level page, or a child whose path
      // was overridden) under its file parent. Inserting the path relative to the
      // parent keeps params added by the override without duplicating the parent's
      // own params; a path detached from the parent has no such remainder, so fall
      // back to the path derived by unrouting.
      insertedPath = relativizeToParent(parent.fullPath, page.path) ?? ctx.originalPagePaths.get(page) ?? page.path
    }
    // TODO: waiting on vuejs/router#2748 to allow adding a route without a
    // file, or we need to find another way if it is not merged
    // @ts-expect-error `page.file` is possibly undefined
    const route = parent.insert(insertedPath, page.file)
    if (page.path[0] === '/' && route.path !== page.path) {
      // The path setter records the absolute path as an override on the node.
      // Since the override is absolute, `fullPath` returns it as-is instead of
      // joining parent paths, while params stay based on the path derived by
      // unrouting.
      route.path = page.path
    }

    for (const [viewName, file] of Object.entries(page.components || {})) {
      if (viewName !== 'default') {
        route.components.set(viewName, file)
      }
    }
    if (page.meta) {
      route.addToMeta(page.meta)
    }
    if (page.alias) {
      route.addAlias(Array.isArray(page.alias) ? page.alias : [page.alias])
    }

    // Mirror the runtime tree, where a parent with an empty-path index child is
    // unnamed and the index owns the name. An empty string marks the node as unnamed.
    // Using `undefined` would fall back to the auto-generated segment name, which can
    // collide with the index child's name and drop a route from the generated map.
    route.name = page.name || ''

    // TODO: implement redirect support
    for (const child of page.children || []) {
      addPage(route, child)
    }
  }

  const typedRouterOptions: TypedRouterOptions = {
    root: nuxt.options.rootDir,
    routesFolder: [],
    dts: declarationFile,
    logs: nuxt.options.debug && nuxt.options.debug.router,
    async beforeWriteFiles (rootPage) {
      for (const child of rootPage.children) {
        child.delete()
      }
      const pages = nuxt.apps.default?.pages || await ctx.resolvePages()
      if (nuxt.apps.default) {
        nuxt.apps.default.pages = pages
      }
      for (const page of pages) {
        addPage(rootPage, page)
      }
    },
  }

  nuxt.hook('prepare:types', ({ references }) => {
    references.push({ path: declarationFile })
  })

  const { createRoutesContext, resolveOptions } = await import('vue-router/unplugin')
  const context = createRoutesContext(resolveOptions(typedRouterOptions))

  // Generate types/typed-router.d.ts once app pages are resolved, and again when they change
  nuxt.hook('app:templatesGenerated', async (_app, _templates, options) => {
    if (!options?.filter || options.filter({ filename: 'routes.mjs' } as any)) {
      // Nuxt watches pages itself; a vue-router watcher would turn later scans into no-ops
      await context.scanPages(false)
    }
  })
}
