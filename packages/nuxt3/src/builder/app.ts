import { resolve } from 'path'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'

export interface NuxtApp {
  srcDir: string
  main?: string
  routes: NuxtRoute[]
}

// Scan project structure
export async function resolveApp (builder: Builder, srcDir: string): Promise<NuxtApp> {
  const { nuxt } = builder

  // Create base app object
  const app: NuxtApp = {
    srcDir,
    main: '',
    routes: []
  }

  // Resolve App.vue
  app.main = nuxt.resolver.tryResolvePath('~/App') ||
    nuxt.resolver.tryResolvePath('~/app') ||
    resolve(nuxt.options.appDir, 'app.vue')

  // Resolve pages/
  app.routes.push(...await resolvePagesRoutes(builder, app))

  return app
}
