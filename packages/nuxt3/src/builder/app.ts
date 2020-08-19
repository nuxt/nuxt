import { resolve } from 'path'
import defu from 'defu'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'

export interface NuxtApp {
  main: string
  routes: NuxtRoute[]
  srcDir?: string
  dir: string
  extensions: string[]
  pages?: {
    dir: string
  }
}

// Scan project structure
export async function resolveApp (builder: Builder, options: Partial<NuxtApp> = {}): Promise<NuxtApp> {
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
      nuxt.resolver.tryResolvePath('~/app') ||
      resolve(nuxt.options.appDir, 'app.vue')
  }

  // Resolve pages/
  if (app.pages) {
    app.routes.push(...await resolvePagesRoutes(builder, app))
  }

  return app
}
