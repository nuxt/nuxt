import Vue from 'vue'

const noopData = () => ({})

// window.onNuxtReady(() => console.log('Ready')) hook
// Useful for jsdom testing or plugins (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
if (process.client) {
  window._nuxtReadyCbs = []
  window.onNuxtReady = (cb) => {
    window._nuxtReadyCbs.push(cb)
  }
}

export function empty() {}

export function globalHandleError(error) {
  if (Vue.config.errorHandler) {
    Vue.config.errorHandler(error)
  }
}

export function applyAsyncData(Component, asyncData) {
  const ComponentData = Component.options.data || noopData
  // Prevent calling this method for each request on SSR context
  if (!asyncData && Component.options.hasAsyncData) {
    return
  }
  Component.options.hasAsyncData = true
  Component.options.data = function () {
    const data =  ComponentData.call(this)
    if (this.$ssrContext) {
      asyncData = this.$ssrContext.asyncData[Component.cid]
    }
    return { ...data, ...asyncData }
  }
  if (Component._Ctor && Component._Ctor.options) {
    Component._Ctor.options.data = Component.options.data
  }
}

export function sanitizeComponent(Component) {
  // If Component already sanitized
  if (Component.options && Component._Ctor === Component) {
    return Component
  }
  if (!Component.options) {
    Component = Vue.extend(Component) // fix issue #6
    Component._Ctor = Component
  } else {
    Component._Ctor = Component
    Component.extendOptions = Component.options
  }
  // For debugging purpose
  if (!Component.options.name && Component.options.__file) {
    Component.options.name = Component.options.__file
  }
  return Component
}

export function getMatchedComponents(route, matches = false) {
  return Array.prototype.concat.apply([], route.matched.map((m, index) => {
    return Object.keys(m.components).map((key) => {
      matches && matches.push(index)
      return m.components[key]
    })
  }))
}

export function getMatchedComponentsInstances(route, matches = false) {
  return Array.prototype.concat.apply([], route.matched.map((m, index) => {
    return Object.keys(m.instances).map((key) => {
      matches && matches.push(index)
      return m.instances[key]
    })
  }))
}

export function flatMapComponents(route, fn) {
  return Array.prototype.concat.apply([], route.matched.map((m, index) => {
    return Object.keys(m.components).reduce((promises, key) => {
      if (m.components[key]) {
        promises.push(fn(m.components[key], m.instances[key], m, key, index))
      } else {
        delete m.components[key]
      }
      return promises
    }, [])
  }))
}

export function resolveRouteComponents(route) {
  return Promise.all(
    flatMapComponents(route, async (Component, _, match, key) => {
      // If component is a function, resolve it
      if (typeof Component === 'function' && !Component.options) {
        Component = await Component()
      }
      return match.components[key] = sanitizeComponent(Component)
    })
  )
}

export async function getRouteData(route) {
  // Make sure the components are resolved (code-splitting)
  await resolveRouteComponents(route)
  // Send back a copy of route with meta based on Component definition
  return {
    ...route,
    meta: getMatchedComponents(route).map((Component) => {
      return Component.options.meta || {}
    })
  }
}

export async function setContext(app, context) {
  const route = (context.to ? context.to : context.route)
  // If context not defined, create it
  if (!app.context) {
    app.context = {
      isStatic: process.static,
      isDev: <%= isDev %>,
      isHMR: false,
      app,
      <%= (store ? 'store: app.store,' : '') %>
      payload: context.payload,
      error: context.error,
      base: '<%= router.base %>',
      env: <%= JSON.stringify(env) %>
    }
    // Only set once
    if (context.req) app.context.req = context.req
    if (context.res) app.context.res = context.res
    app.context.redirect = (status, path, query) => {
      if (!status) {
        return
      }
      // Used in middleware
      app.context._redirected = true
      // if only 1 or 2 arguments: redirect('/') or redirect('/', { foo: 'bar' })
      let pathType = typeof path
      if (typeof status !== 'number' && (pathType === 'undefined' || pathType === 'object')) {
        query = path || {}
        path = status
        pathType = typeof path
        status = 302
      }
      if (pathType === 'object') {
        path = app.router.resolve(path).href
      }
      // "/absolute/route", "./relative/route" or "../relative/route"
      if (/(^[.]{1,2}\/)|(^\/(?!\/))/.test(path)) {
        app.context.next({
          path: path,
          query: query,
          status: status
        })
      } else {
        path = formatUrl(path, query)
        if (process.server) {
          app.context.next({
            path: path,
            status: status
          })
        }
        if (process.client) {
          // https://developer.mozilla.org/en-US/docs/Web/API/Location/replace
          window.location.replace(path)

          // Throw a redirect error
          throw new Error('ERR_REDIRECT')
        }
      }
    }
    if (process.server) app.context.beforeNuxtRender = fn => context.beforeRenderFns.push(fn)
    if (process.client) app.context.nuxtState = window.__NUXT__
  }
  // Dynamic keys
  app.context.next = context.next
  app.context._redirected = false
  app.context._errored = false
  app.context.isHMR = !!context.isHMR
  if (context.route) {
    app.context.route = await getRouteData(context.route)
  }
  app.context.params = app.context.route.params || {}
  app.context.query = app.context.route.query || {}
  if (context.from) {
    app.context.from = await getRouteData(context.from)
  }
}

export function middlewareSeries(promises, appContext) {
  if (!promises.length || appContext._redirected || appContext._errored) {
    return Promise.resolve()
  }
  return promisify(promises[0], appContext)
  .then(() => {
    return middlewareSeries(promises.slice(1), appContext)
  })
}

export function promisify(fn, context) {
  let promise
  if (fn.length === 2) {
    // fn(context, callback)
    promise = new Promise((resolve) => {
      fn(context, function (err, data) {
        if (err) {
          context.error(err)
        }
        data = data || {}
        resolve(data)
      })
    })
  } else {
    promise = fn(context)
  }
  if (!promise || (!(promise instanceof Promise) && (typeof promise.then !== 'function'))) {
    promise = Promise.resolve(promise)
  }
  return promise
}

// Imported from vue-router
export function getLocation(base, mode) {
  var path = window.location.pathname
  if (mode === 'hash') {
    return window.location.hash.replace(/^#\//, '')
  }
  if (base && path.indexOf(base) === 0) {
    path = path.slice(base.length)
  }
  return (path || '/') + window.location.search + window.location.hash
}

export function urlJoin() {
  return Array.prototype.slice.call(arguments).join('/').replace(/\/+/g, '/')
}

// Imported from path-to-regexp

/**
 * Compile a string to a template function for the path.
 *
 * @param  {string}             str
 * @param  {Object=}            options
 * @return {!function(Object=, Object=)}
 */
export function compile(str, options) {
  return tokensToFunction(parse(str, options))
}

export function getQueryDiff(toQuery, fromQuery) {
  const diff = {}
  const queries = { ...toQuery, ...fromQuery }
  for (const k in queries) {
    if (String(toQuery[k]) !== String(fromQuery[k])) {
      diff[k] = true
    }
  }
  return diff
}

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
const PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {string}  str
 * @param  {Object=} options
 * @return {!Array}
 */
function parse(str, options) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var defaultDelimiter = options && options.delimiter || '/'
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    var next = str[index]
    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var modifier = res[6]
    var asterisk = res[7]

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var partial = prefix != null && next != null && next !== prefix
    var repeat = modifier === '+' || modifier === '*'
    var optional = modifier === '?' || modifier === '*'
    var delimiter = res[2] || defaultDelimiter
    var pattern = capture || group

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      partial: partial,
      asterisk: !!asterisk,
      pattern: pattern ? escapeGroup(pattern) : (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?')
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Prettier encoding of URI path segments.
 *
 * @param  {string}
 * @return {string}
 */
function encodeURIComponentPretty(str) {
  return encodeURI(str).replace(/[\/?#]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
 *
 * @param  {string}
 * @return {string}
 */
function encodeAsterisk(str) {
  return encodeURI(str).replace(/[?#]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction(tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$')
    }
  }

  return function(obj, opts) {
    var path = ''
    var data = obj || {}
    var options = opts || {}
    var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          // Prepend partial segment prefixes.
          if (token.partial) {
            path += token.prefix
          }

          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (Array.isArray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encode(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = token.asterisk ? encodeAsterisk(value) : encode(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {string} str
 * @return {string}
 */
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {string} group
 * @return {string}
 */
function escapeGroup(group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Format given url, append query to url query string
 *
 * @param  {string} url
 * @param  {string} query
 * @return {string}
 */
function formatUrl (url, query) {
  let protocol
  let index = url.indexOf('://')
  if (index !== -1) {
    protocol = url.substring(0, index)
    url = url.substring(index + 3)
  } else if (url.indexOf('//') === 0) {
    url = url.substring(2)
  }

  let parts = url.split('/')
  let result = (protocol ? protocol + '://' : '//') + parts.shift()

  let path = parts.filter(Boolean).join('/')
  let hash
  parts = path.split('#')
  if (parts.length === 2) {
    path = parts[0]
    hash = parts[1]
  }

  result += path ? '/' + path : ''

  if (query && JSON.stringify(query) !== '{}') {
    result += (url.split('?').length === 2 ? '&' : '?') + formatQuery(query)
  }
  result += hash ? '#' + hash : ''

  return result
}

/**
 * Transform data object to query string
 *
 * @param  {object} query
 * @return {string}
 */
function formatQuery (query) {
  return Object.keys(query).sort().map((key) => {
    var val = query[key]
    if (val == null) {
      return ''
    }
    if (Array.isArray(val)) {
      return val.slice().map(val2 => [key, '=', val2].join('')).join('&')
    }
    return key + '=' + val
  }).filter(Boolean).join('&')
}
