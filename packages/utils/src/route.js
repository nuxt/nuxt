import path from 'path'
import get from 'lodash/get'
import consola from 'consola'

import { r } from './resolve'

const routeChildren = function (route) {
  const hasChildWithEmptyPath = route.children.some(child => child.path === '')
  if (hasChildWithEmptyPath) {
    return route.children
  }
  return [
    // Add default child to render parent page
    {
      ...route,
      children: undefined
    },
    ...route.children
  ]
}

export const flatRoutes = function flatRoutes (router, fileName = '', routes = []) {
  router.forEach((r) => {
    if ([':', '*'].some(c => r.path.includes(c))) {
      return
    }
    const route = `${fileName}${r.path}/`.replace(/\/+/g, '/')
    if (r.children) {
      return flatRoutes(routeChildren(r), route, routes)
    }

    // if child path is already absolute, do not make any concatenations
    if (r.path && r.path.startsWith('/')) {
      routes.push(r.path)
    } else if (route !== '/' && route[route.length - 1] === '/') {
      routes.push(route.slice(0, -1))
    } else {
      routes.push(route)
    }
  })
  return routes
}

function cleanChildrenRoutes (routes, isChild = false, routeNameSplitter = '-', trailingSlash, parentRouteName) {
  const regExpIndex = new RegExp(`${routeNameSplitter}index$`)
  const regExpParentRouteName = new RegExp(`^${parentRouteName}${routeNameSplitter}`)
  const routesIndex = []
  routes.forEach((route) => {
    if (regExpIndex.test(route.name) || route.name === 'index') {
      const res = route.name.replace(regExpParentRouteName, '').split(routeNameSplitter)
      routesIndex.push(res)
    }
  })
  routes.forEach((route) => {
    route.path = isChild ? route.path.replace('/', '') : route.path
    if (route.path.includes('?')) {
      if (route.name.endsWith(`${routeNameSplitter}index`)) {
        route.path = route.path.replace(/\?$/, '')
      }
      const names = route.name.replace(regExpParentRouteName, '').split(routeNameSplitter)
      const paths = route.path.split('/')
      if (!isChild) {
        paths.shift()
      } // clean first / for parents
      routesIndex.forEach((r) => {
        const i = r.indexOf('index')
        if (i < paths.length) {
          for (let a = 0; a <= i; a++) {
            if (a === i) {
              paths[a] = paths[a].replace('?', '')
            }
            if (a < i && names[a] !== r[a]) {
              break
            }
          }
        }
      })
      route.path = (isChild ? '' : '/') + paths.join('/')
    }
    route.name = route.name.replace(regExpIndex, '')
    if (route.children) {
      const indexRoutePath = trailingSlash === false ? '/' : ''
      const defaultChildRoute = route.children.find(child => child.path === indexRoutePath)
      const routeName = route.name
      if (defaultChildRoute) {
        if (trailingSlash === false) {
          defaultChildRoute.name = route.name
        }
        delete route.name
      }
      route.children = cleanChildrenRoutes(route.children, true, routeNameSplitter, trailingSlash, routeName)
    }
  })
  return routes
}

const DYNAMIC_ROUTE_REGEX = /^\/([:*])/

export const sortRoutes = function sortRoutes (routes) {
  routes.sort((a, b) => {
    if (!a.path.length) {
      return -1
    }
    if (!b.path.length) {
      return 1
    }
    // Order: /static, /index, /:dynamic
    // Match exact route before index: /login before /index/_slug
    if (a.path === '/') {
      return DYNAMIC_ROUTE_REGEX.test(b.path) ? -1 : 1
    }
    if (b.path === '/') {
      return DYNAMIC_ROUTE_REGEX.test(a.path) ? 1 : -1
    }

    let i
    let res = 0
    let y = 0
    let z = 0
    const _a = a.path.split('/')
    const _b = b.path.split('/')
    for (i = 0; i < _a.length; i++) {
      if (res !== 0) {
        break
      }
      y = _a[i] === '*' ? 2 : _a[i].includes(':') ? 1 : 0
      z = _b[i] === '*' ? 2 : _b[i].includes(':') ? 1 : 0
      res = y - z
      // If a.length >= b.length
      if (i === _b.length - 1 && res === 0) {
        // unless * found sort by level, then alphabetically
        res = _a[i] === '*' ? -1 : (
          _a.length === _b.length ? a.path.localeCompare(b.path) : (_a.length - _b.length)
        )
      }
    }

    if (res === 0) {
      // unless * found sort by level, then alphabetically
      res = _a[i - 1] === '*' && _b[i] ? 1 : (
        _a.length === _b.length ? a.path.localeCompare(b.path) : (_a.length - _b.length)
      )
    }
    return res
  })

  routes.forEach((route) => {
    if (route.children) {
      sortRoutes(route.children)
    }
  })

  return routes
}

export const createRoutes = function createRoutes ({
  files,
  srcDir,
  pagesDir = '',
  routeNameSplitter = '-',
  supportedExtensions = ['vue', 'js'],
  trailingSlash
}) {
  const routes = []
  files.forEach((file) => {
    const keys = file
      .replace(new RegExp(`^${pagesDir}`), '')
      .replace(new RegExp(`\\.(${supportedExtensions.join('|')})$`), '')
      .replace(/\/{2,}/g, '/')
      .split('/')
      .slice(1)
    const route = { name: '', path: '', component: r(srcDir, file) }
    let parent = routes
    keys.forEach((key, i) => {
      // remove underscore only, if its the prefix
      const sanitizedKey = key.startsWith('_') ? key.substr(1) : key

      route.name = route.name
        ? route.name + routeNameSplitter + sanitizedKey
        : sanitizedKey
      route.name += key === '_' ? 'all' : ''
      route.chunkName = file.replace(new RegExp(`\\.(${supportedExtensions.join('|')})$`), '')
      const child = parent.find(parentRoute => parentRoute.name === route.name)

      if (child) {
        child.children = child.children || []
        parent = child.children
        route.path = ''
      } else if (key === 'index' && i + 1 === keys.length) {
        route.path += i > 0 ? '' : '/'
      } else {
        route.path += '/' + getRoutePathExtension(key)

        if (key.startsWith('_') && key.length > 1) {
          route.path += '?'
        }
      }
    })
    if (trailingSlash !== undefined) {
      route.pathToRegexpOptions = { ...route.pathToRegexpOptions, strict: true }
      route.path = route.path.replace(/\/+$/, '') + (trailingSlash ? '/' : '') || '/'
    }

    parent.push(route)
  })

  sortRoutes(routes)
  return cleanChildrenRoutes(routes, false, routeNameSplitter, trailingSlash)
}

// Guard dir1 from dir2 which can be indiscriminately removed
export const guardDir = function guardDir (options, key1, key2) {
  const dir1 = get(options, key1, false)
  const dir2 = get(options, key2, false)

  if (
    dir1 &&
    dir2 &&
    (
      dir1 === dir2 ||
      (
        dir1.startsWith(dir2) &&
        !path.basename(dir1).startsWith(path.basename(dir2))
      )
    )
  ) {
    const errorMessage = `options.${key2} cannot be a parent of or same as ${key1}`
    consola.fatal(errorMessage)
    throw new Error(errorMessage)
  }
}

const getRoutePathExtension = (key) => {
  if (key === '_') {
    return '*'
  }

  if (key.startsWith('_')) {
    return `:${key.substr(1)}`
  }

  return key
}

export const promisifyRoute = function promisifyRoute (fn, ...args) {
  // If routes is an array
  if (Array.isArray(fn)) {
    return Promise.resolve(fn)
  }
  // If routes is a function expecting a callback
  if (fn.length === arguments.length) {
    return new Promise((resolve, reject) => {
      fn((err, routeParams) => {
        if (err) {
          reject(err)
        }
        resolve(routeParams)
      }, ...args)
    })
  }
  let promise = fn(...args)
  if (
    !promise ||
    (!(promise instanceof Promise) && typeof promise.then !== 'function')
  ) {
    promise = Promise.resolve(promise)
  }
  return promise
}
