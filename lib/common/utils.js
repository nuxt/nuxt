import { resolve, relative, sep } from 'path'
import _ from 'lodash'

export function encodeHtml (str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function getContext (req, res) {
  return { req, res }
}

export function setAnsiColors (ansiHTML) {
  ansiHTML.setColors({
    reset: ['efefef', 'a6004c'],
    darkgrey: '5a012b',
    yellow: 'ffab07',
    green: 'aeefba',
    magenta: 'ff84bf',
    blue: '3505a0',
    cyan: '56eaec',
    red: '4e053a'
  })
}

export async function waitFor (ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, (ms || 0))
  })
}

export function urlJoin () {
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/').replace(':/', '://')
}

export function isUrl (url) {
  return (url.indexOf('http') === 0 || url.indexOf('//') === 0)
}

export function promisifyRoute (fn) {
  // If routes is an array
  if (Array.isArray(fn)) {
    return Promise.resolve(fn)
  }
  // If routes is a function expecting a callback
  if (fn.length === 1) {
    return new Promise((resolve, reject) => {
      fn(function (err, routeParams) {
        if (err) {
          reject(err)
        }
        resolve(routeParams)
      })
    })
  }
  let promise = fn()
  if (!promise || (!(promise instanceof Promise) && (typeof promise.then !== 'function'))) {
    promise = Promise.resolve(promise)
  }
  return promise
}

export function sequence (tasks, fn) {
  return tasks.reduce((promise, task) => promise.then(() => fn(task)), Promise.resolve())
}

export function parallel (tasks, fn) {
  return Promise.all(tasks.map(task => fn(task)))
}

export function chainFn (base, fn) {
  /* istanbul ignore if */
  if (!(fn instanceof Function)) {
    return
  }
  return function () {
    if (base instanceof Function) {
      base.apply(this, arguments)
    }
    fn.apply(this, arguments)
  }
}

export function wp (p) {
  /* istanbul ignore if */
  if (/^win/.test(process.platform)) {
    p = p.replace(/\\/g, '\\\\')
  }
  return p
}

const reqSep = /\//g
const sysSep = _.escapeRegExp(sep)
const normalize = string => string.replace(reqSep, sysSep)

export function r () {
  let args = Array.prototype.slice.apply(arguments)
  let lastArg = _.last(args)

  if (lastArg.includes('@') || lastArg.includes('~')) {
    return wp(lastArg)
  }

  return wp(resolve(...args.map(normalize)))
}

export function relativeTo () {
  let args = Array.prototype.slice.apply(arguments)
  let dir = args.shift()

  // Resolve path
  let path = r(...args)

  // Check if path is an alias
  if (path.includes('@') || path.includes('~')) {
    return path
  }

  // Make correct relative path
  let rp = relative(dir, path)
  if (rp[0] !== '.') {
    rp = './' + rp
  }
  return wp(rp)
}

export function flatRoutes (router, path = '', routes = []) {
  router.forEach((r) => {
    if (!r.path.includes(':') && !r.path.includes('*')) {
      /* istanbul ignore if */
      if (r.children) {
        flatRoutes(r.children, path + r.path + '/', routes)
      } else {
        routes.push((r.path === '' && path[path.length - 1] === '/' ? path.slice(0, -1) : path) + r.path)
      }
    }
  })
  return routes
}

export function cleanChildrenRoutes (routes, isChild = false) {
  let start = -1
  let routesIndex = []
  routes.forEach((route) => {
    if (/-index$/.test(route.name) || route.name === 'index') {
      // Save indexOf 'index' key in name
      let res = route.name.split('-')
      let s = res.indexOf('index')
      start = (start === -1 || s < start) ? s : start
      routesIndex.push(res)
    }
  })
  routes.forEach((route) => {
    route.path = (isChild) ? route.path.replace('/', '') : route.path
    if (route.path.indexOf('?') > -1) {
      let names = route.name.split('-')
      let paths = route.path.split('/')
      if (!isChild) {
        paths.shift()
      } // clean first / for parents
      routesIndex.forEach((r) => {
        let i = r.indexOf('index') - start //  children names
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
      if (route.children.find((child) => child.path === '')) {
        delete route.name
      }
      route.children = cleanChildrenRoutes(route.children, true)
    }
  })
  return routes
}

export function createRoutes (files, srcDir) {
  let routes = []
  files.forEach((file) => {
    let keys = file.replace(/^pages/, '').replace(/\.vue$/, '').replace(/\/{2,}/g, '/').split('/').slice(1)
    let route = { name: '', path: '', component: r(srcDir, file) }
    let parent = routes
    keys.forEach((key, i) => {
      route.name = route.name ? route.name + '-' + key.replace('_', '') : key.replace('_', '')
      route.name += (key === '_') ? 'all' : ''
      let child = _.find(parent, { name: route.name })
      if (child) {
        if (!child.children) {
          child.children = []
        }
        parent = child.children
        route.path = ''
      } else {
        if (key === 'index' && (i + 1) === keys.length) {
          route.path += (i > 0 ? '' : '/')
        } else {
          route.path += '/' + (key === '_' ? '*' : key.replace('_', ':'))
          if (key !== '_' && key.indexOf('_') !== -1) {
            route.path += '?'
          }
        }
      }
    })
    // Order Routes path
    parent.push(route)
    parent.sort((a, b) => {
      if (!a.path.length || a.path === '/') {
        return -1
      }
      if (!b.path.length || b.path === '/') {
        return 1
      }
      let res = 0
      let _a = a.path.split('/')
      let _b = b.path.split('/')
      for (let i = 0; i < _a.length; i++) {
        if (res !== 0) {
          break
        }
        let y = (_a[i].indexOf('*') > -1) ? 2 : (_a[i].indexOf(':') > -1 ? 1 : 0)
        let z = (_b[i].indexOf('*') > -1) ? 2 : (_b[i].indexOf(':') > -1 ? 1 : 0)
        res = y - z
        if (i === _b.length - 1 && res === 0) {
          res = 1
        }
      }
      return res === 0 ? -1 : res
    })
  })
  return cleanChildrenRoutes(routes)
}
