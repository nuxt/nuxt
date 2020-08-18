import { resolve } from 'path'
import globby from 'globby'
import { Builder } from './builder'

export interface NuxtRoute {
  name?: string
  path: string
  component: string
  children?: NuxtRoute[]
}

export interface NuxtApp {
  srcDir: string
  main?: string
  routes: NuxtRoute[]
}

// Scan project structure
export async function resolveApp (builder: Builder, srcDir: string): Promise<NuxtApp> {
  const { nuxt } = builder
  // resolve App.vue
  const main = nuxt.resolver.tryResolvePath('~/App') ||
    nuxt.resolver.tryResolvePath('~/app') ||
    resolve(nuxt.options.appDir, 'app.vue')

  const pagesPattern = `${nuxt.options.dir.pages}/**/*.{${nuxt.options.extensions.join(',')}}`
  const pages = await resolveFiles(builder, pagesPattern, srcDir)
  const routes = buildRoutes(pages, srcDir, nuxt.options.dir.pages, nuxt.options.extensions)

  console.log('routes', routes)
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

async function resolveFiles (builder: Builder, pattern: string, srcDir: string) {
  const { nuxt } = builder

  return builder.ignore.filter(await globby(pattern, {
    cwd: srcDir,
    followSymbolicLinks: nuxt.options.build.followSymlinks
  }))
}

const isDynamicRoute = (s: string) => /^\[.+\]$/.test(s)

export function buildRoutes (
  files: string[],
  srcDir: string,
  pagesDir: string,
  extensions: string[]
) {
  const routes: NuxtRoute[] = []

  for (const file of files) {
    const pathParts = file
      .replace(new RegExp(`^${pagesDir}`), '')
      .replace(new RegExp(`\\.(${extensions.join('|')})$`), '')
      .split('/')
      .slice(1) // removing the pagesDir means that the path begins with a '/'

    const route: NuxtRoute = {
      name: '',
      path: '',
      component: resolve(srcDir, file)
    }

    let parent = routes

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      // Remove square brackets at the start and end.
      const isDynamicPart = isDynamicRoute(part)
      const normalizedPart = (isDynamicPart
        ? part.replace(/^\[(\.{3})?/, '').replace(/\]$/, '')
        : part
      ).toLowerCase()

      route.name += route.name ? `-${normalizedPart}` : normalizedPart

      const child = parent.find(
        parentRoute => parentRoute.name === route.name
      )
      if (child) {
        child.children = child.children || []
        parent = child.children
        route.path = ''
      } else if (normalizedPart === 'index' && !route.path) {
        route.path += '/'
      } else if (normalizedPart !== 'index') {
        if (isDynamicPart) {
          route.path += `/:${normalizedPart}`

          // Catch-all route
          if (/^\[\.{3}/.test(part)) {
            route.path += '(.*)'
          } else if (i === pathParts.length - 1) {
            route.path += '?'
          }
        } else {
          route.path += `/${normalizedPart}`
        }
      }
    }

    parent.push(route)
  }

  return prepareRoutes(routes)
}

function prepareRoutes (routes: NuxtRoute[], hasParent = false) {
  for (const route of routes) {
    if (route.name) {
      route.name = route.name.replace(/-index$/, '')
    }

    if (hasParent) {
      route.path = route.path.replace(/^\//, '').replace(/\?$/, '')
    }

    if (route.children) {
      delete route.name
      route.children = prepareRoutes(route.children, true)
    }
  }
  return routes
}
