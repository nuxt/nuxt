import { resolve } from 'path'
import defu from 'defu'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'

export interface NuxtApp {
  main: string
  routes: NuxtRoute[]
  dir: string
  extensions: string[]
  pages?: {
    dir: string
  }
}

// Scan project structure
export async function createApp (builder: Builder, options: Partial<NuxtApp> = {}): Promise<NuxtApp> {
  const { nuxt } = builder

  // Create base app object
  const app: NuxtApp = defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    routes: [],
    pages: {
      dir: 'pages'
    }
  })

  // Resolve app.main
  if (!app.main) {
    app.main = nuxt.resolver.tryResolvePath('~/App') ||
      nuxt.resolver.tryResolvePath('~/app')
  }

  // Resolve pages/
  if (app.pages) {
    app.routes.push(...await resolvePagesRoutes(builder, app))
  }

  // Fallback app.main
  if (!app.main && app.routes.length) {
    app.main = resolve(nuxt.options.appDir, 'app.pages.vue')
  } else if (!app.main) {
    app.main = resolve(nuxt.options.appDir, 'app.tutorial.vue')
  }

  return app
}
