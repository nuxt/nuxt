import path from 'path'
import _ from 'lodash'
import consola from 'consola'

export const encodeHtml = function encodeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const getContext = function getContext(req, res) {
  return { req, res }
}

export const waitFor = function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms || 0))
}

export const isString = function isString(obj) {
  return typeof obj === 'string' || obj instanceof String
}
export const startsWithAlias = aliasArray => str => aliasArray.some(c => str.startsWith(c))

export const startsWithSrcAlias = startsWithAlias(['@', '~'])

export const startsWithRootAlias = startsWithAlias(['@@', '~~'])

async function promiseFinally(fn, finalFn) {
  let result
  try {
    if (typeof fn === 'function') {
      result = await fn()
    } else {
      result = await fn
    }
  } finally {
    finalFn()
  }
  return result
}

export const timeout = function timeout(fn, ms, msg) {
  let timerId
  const warpPromise = promiseFinally(fn, () => clearTimeout(timerId))
  const timerPromise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => reject(new Error(msg)), ms)
  })
  return Promise.race([warpPromise, timerPromise])
}

export const urlJoin = function urlJoin() {
  return [].slice
    .call(arguments)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(':/', '://')
}

export const isUrl = function isUrl(url) {
  return ['http', '//'].some(str => url.startsWith(str))
}

export const promisifyRoute = function promisifyRoute(fn, ...args) {
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

export const sequence = function sequence(tasks, fn) {
  return tasks.reduce(
    (promise, task) => promise.then(() => fn(task)),
    Promise.resolve()
  )
}

export const parallel = function parallel(tasks, fn) {
  return Promise.all(tasks.map(fn))
}

export const chainFn = function chainFn(base, fn) {
  /* istanbul ignore if */
  if (typeof fn !== 'function') {
    return base
  }
  return function () {
    if (typeof base !== 'function') {
      return fn.apply(this, arguments)
    }
    let baseResult = base.apply(this, arguments)
    // Allow function to mutate the first argument instead of returning the result
    if (baseResult === undefined) {
      baseResult = arguments[0]
    }
    const fnResult = fn.call(
      this,
      baseResult,
      ...Array.prototype.slice.call(arguments, 1)
    )
    // Return mutated argument if no result was returned
    if (fnResult === undefined) {
      return baseResult
    }
    return fnResult
  }
}

export const isPureObject = function isPureObject(o) {
  return !Array.isArray(o) && typeof o === 'object'
}

export const isWindows = /^win/.test(process.platform)

export const wp = function wp(p = '') {
  /* istanbul ignore if */
  if (isWindows) {
    return p.replace(/\\/g, '\\\\')
  }
  return p
}

export const wChunk = function wChunk(p = '') {
  /* istanbul ignore if */
  if (isWindows) {
    return p.replace(/\//g, '_')
  }
  return p
}

const reqSep = /\//g
const sysSep = _.escapeRegExp(path.sep)
const normalize = string => string.replace(reqSep, sysSep)

export const r = function r(...args) {
  const lastArg = args[args.length - 1]

  if (startsWithSrcAlias(lastArg)) {
    return wp(lastArg)
  }

  return wp(path.resolve(...args.map(normalize)))
}

export const relativeTo = function relativeTo() {
  const args = Array.prototype.slice.apply(arguments)
  const dir = args.shift()

  // Keep webpack inline loader intact
  if (args[0].includes('!')) {
    const loaders = args.shift().split('!')

    return loaders.concat(relativeTo(dir, loaders.pop(), ...args)).join('!')
  }

  // Resolve path
  const _path = r(...args)

  // Check if path is an alias
  if (startsWithSrcAlias(_path)) {
    return _path
  }

  // Make correct relative path
  let rp = path.relative(dir, _path)
  if (rp[0] !== '.') {
    rp = './' + rp
  }

  return wp(rp)
}

export const flatRoutes = function flatRoutes(router, _path = '', routes = []) {
  router.forEach((r) => {
    if ([':', '*'].some(c => r.path.includes(c))) {
      return
    }
    /* istanbul ignore if */
    if (r.children) {
      if (_path === '' && r.path === '/') {
        routes.push('/')
      }
      return flatRoutes(r.children, _path + r.path + '/', routes)
    }
    _path = _path.replace(/^\/+$/, '/')
    routes.push(
      (r.path === '' && _path[_path.length - 1] === '/'
        ? _path.slice(0, -1)
        : _path) + r.path
    )
  })
  return routes
}

function cleanChildrenRoutes(routes, isChild = false) {
  let start = -1
  const routesIndex = []
  routes.forEach((route) => {
    if (/-index$/.test(route.name) || route.name === 'index') {
      // Save indexOf 'index' key in name
      const res = route.name.split('-')
      const s = res.indexOf('index')
      start = start === -1 || s < start ? s : start
      routesIndex.push(res)
    }
  })
  routes.forEach((route) => {
    route.path = isChild ? route.path.replace('/', '') : route.path
    if (route.path.includes('?')) {
      const names = route.name.split('-')
      const paths = route.path.split('/')
      if (!isChild) {
        paths.shift()
      } // clean first / for parents
      routesIndex.forEach((r) => {
        const i = r.indexOf('index') - start //  children names
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
    route.name = route.name.replace(/-index$/, '')
    if (route.children) {
      if (route.children.find(child => child.path === '')) {
        delete route.name
      }
      route.children = cleanChildrenRoutes(route.children, true)
    }
  })
  return routes
}

export const createRoutes = function createRoutes(files, srcDir, pagesDir) {
  const routes = []
  files.forEach((file) => {
    const keys = file
      .replace(RegExp(`^${pagesDir}`), '')
      .replace(/\.(vue|js)$/, '')
      .replace(/\/{2,}/g, '/')
      .split('/')
      .slice(1)
    const route = { name: '', path: '', component: r(srcDir, file) }
    let parent = routes
    keys.forEach((key, i) => {
      // remove underscore only, if its the prefix
      const sanitizedKey = key.startsWith('_') ? key.substr(1) : key

      route.name = route.name
        ? route.name + '-' + sanitizedKey
        : sanitizedKey
      route.name += key === '_' ? 'all' : ''
      route.chunkName = file.replace(/\.(vue|js)$/, '')
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
    // Order Routes path
    parent.push(route)
    parent.sort((a, b) => {
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
          // change order if * found
          res = _a[i] === '*' ? -1 : 1
        }
      }
      return res === 0 ? (_a[i - 1] === '*' && _b[i] ? 1 : -1) : res
    })
  })
  return cleanChildrenRoutes(routes)
}

// Guard dir1 from dir2 which can be indiscriminately removed
export const guardDir = function guardDir(options, key1, key2) {
  const dir1 = _.get(options, key1, false)
  const dir2 = _.get(options, key2, false)

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

export const determineGlobals = function determineGlobals(globalName, globals) {
  const _globals = {}
  for (const global in globals) {
    if (typeof globals[global] === 'function') {
      _globals[global] = globals[global](globalName)
    } else {
      _globals[global] = globals[global]
    }
  }
  return _globals
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

const DYNAMIC_ROUTE_REGEX = /^\/(:|\*)/

/**
 * Wraps value in array if it is not already an array
 *
 * @param  {any} value
 * @return {array}
 */
export const wrapArray = value => Array.isArray(value) ? value : [value]
