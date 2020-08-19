import { resolve } from 'path'
import defu from 'defu'
import { Builder } from './builder'
import { NuxtRoute, resolvePagesRoutes } from './pages'
import { NormalizedConfiguration } from 'src/config'

export interface NuxtApp {
  options: AppOptions
  main?: string
  routes: NuxtRoute[]
}

interface AppOptions {
  srcDir?: string
  dir?: NormalizedConfiguration['dir']
  extensions?: NormalizedConfiguration['extensions']
}

// Scan project structure
export async function resolveApp (builder: Builder, options: AppOptions = {}): Promise<NuxtApp> {
  const { nuxt } = builder

  options = defu(options, {
    srcDir: nuxt.options.srcDir,
    dir: nuxt.options.dir,
    extensions: nuxt.options.extensions
  })

  // Create base app object
  const app: NuxtApp = {
    options,
    // Overwritten by the resolvers
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
