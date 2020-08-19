import { resolve, extname, relative } from 'path'
import { NuxtApp } from './app'
import { resolveFiles } from './utils'

const isDynamicRoute = (s: string) => /^\[.+\]$/.test(s)

export interface NuxtRoute {
  name?: string
  path: string
  file: string
  children?: NuxtRoute[]
}

export async function resolvePagesRoutes (builder, app: NuxtApp) {
  const pagesDir = resolve(app.dir, app.pages!.dir)
  const pagesPattern = `${app.pages!.dir}/**/*.{${app.extensions.join(',')}}`
  const files = await resolveFiles(builder, pagesPattern, app.dir)

  const routes: NuxtRoute[] = []

  for (const file of files) {
    const pathParts = relative(pagesDir, file)
      .replace(new RegExp(`${extname(file)}$`), '')
      .split('/')

    const route: NuxtRoute = {
      name: '',
      path: '',
      file
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
