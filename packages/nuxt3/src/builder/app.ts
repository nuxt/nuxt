import { resolve } from 'path'
import defu from 'defu'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'

export interface NuxtApp {
  main: string
  routes: NuxtRoute[]
  dir: string
  extensions: string[]
  templates: Record<string, string>
  pages?: {
    dir: string
  }
}

// Scan project structure
export async function createApp (
  builder: Builder,
  options: Partial<NuxtApp> = {}
): Promise<NuxtApp> {
  const { nuxt } = builder

  // Create base app object
  const app: NuxtApp = defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    routes: [],
    templates: {},
    pages: {
      dir: 'pages'
    }
  })

  // Resolve app.main
  if (!app.main) {
    app.main =
      nuxt.resolver.tryResolvePath('~/App') ||
      nuxt.resolver.tryResolvePath('~/app')
  }

  // Resolve pages/
  if (app.pages) {
    app.routes.push(...(await resolvePagesRoutes(builder, app)))
  }
  if (app.routes.length) {
    // Add 404 page is not added
    const page404 = app.routes.find(route => route.name === '404')
    if (!page404) {
      app.routes.push({
        name: '404',
        path: '/:catchAll(.*)*',
        file: resolve(nuxt.options.appDir, 'pages/404.vue'),
        children: []
      })
    }
    // TODO: Hook to extend routes
    app.templates.routes = serializeRoutes(app.routes)
  }

  // Fallback app.main
  if (!app.main && app.routes.length) {
    app.main = resolve(nuxt.options.appDir, 'app.pages.vue')
  } else if (!app.main) {
    app.main = resolve(nuxt.options.appDir, 'app.tutorial.vue')
  }

  return app
}

function serializeRoutes (routes: NuxtRoute[]) {
  return JSON.stringify(
    routes.map(formatRoute),
    null,
    2
  ).replace(/"{(.+)}"/g, '$1')
}

function formatRoute (route: NuxtRoute) {
  return {
    name: route.name,
    path: route.path,
    children: route.children.map(formatRoute),
    // TODO: avoid exposing to prod, using process.env.NODE_ENV ?
    __file: route.file,
    component: `{() => import('${route.file}' /* webpackChunkName: '${route.name}' */)}`
  }
}
