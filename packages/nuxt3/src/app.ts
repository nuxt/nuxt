import { resolve } from 'path'
import defu from 'defu'
import { tryResolvePath } from '@nuxt/kit'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'
import { NuxtPlugin, resolvePlugins } from './plugins'

export interface NuxtApp {
  main?: string
  routes: NuxtRoute[]
  dir: string
  extensions: string[]
  plugins: NuxtPlugin[]
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
    plugins: [],
    templates: {},
    pages: {
      dir: 'pages'
    }
  } as NuxtApp)

  // Resolve app.main
  const resolveOptions = {
    base: nuxt.options.srcDir,
    alias: nuxt.options.alias,
    extensions: nuxt.options.extensions
  }

  if (!app.main) {
    app.main = tryResolvePath('~/App', resolveOptions) ||
      tryResolvePath('~/app', resolveOptions)
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
  }

  // Fallback app.main
  if (!app.main && app.routes.length) {
    app.main = resolve(nuxt.options.appDir, 'app.pages.vue')
  } else if (!app.main) {
    app.main = resolve(nuxt.options.appDir, 'app.tutorial.vue')
  }

  // Resolve plugins/
  app.plugins = await resolvePlugins(builder, app)

  return app
}
