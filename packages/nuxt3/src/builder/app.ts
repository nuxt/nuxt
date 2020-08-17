import { resolve } from 'path'

export interface NuxtRoute {
  path: ''
}

export interface NuxtApp {
  srcDir: string
  main?: string
  routes: NuxtRoute[]
}

// Scan project structure
export function resolveApp (nuxt, srcDir: string): NuxtApp {
  // resolve App.vue
  const main = nuxt.resolver.tryResolvePath('~/App') ||
    nuxt.resolver.tryResolvePath('~/app') ||
    resolve(nuxt.options.appDir, 'app.vue')

  // TODO: Read pages/ and create routes
  // TODO: Detect store
  // Use hooks?
  // routes can be resolved with @nuxt/pages module to scan pages/ using a hook
  // Import plugins
  // Middleware
  // Layouts
  // etc.

  return {
    srcDir,
    main,
    routes: []
  }
}
