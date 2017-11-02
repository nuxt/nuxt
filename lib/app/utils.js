import Vue from 'vue'

const noopData = () => ({})

// window.onNuxtReady(() => console.log('Ready')) hook
// Useful for jsdom testing or plugins (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
if (process.browser) {
  window._nuxtReadyCbs = []
  window.onNuxtReady = function (cb) {
    window._nuxtReadyCbs.push(cb)
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

export function getMatchedComponents(route) {
  return [].concat.apply([], route.matched.map(function (m) {
    return Object.keys(m.components).map(function (key) {
      return m.components[key]
    })
  }))
}

export function getMatchedComponentsInstances(route) {
  return [].concat.apply([], route.matched.map(function (m) {
    return Object.keys(m.instances).map(function (key) {
      return m.instances[key]
    })
  }))
}

function getRouteRecordWithParamNames (route) {
  return route.matched.map(m => {
    var paramNames = m.path.match(new RegExp(':[^\\/\\?]+', 'g'))
    if (paramNames !== null) {
      paramNames = paramNames.map(function (name) {
        return name.substring(1)
      })
    }
    return {
      routeRecord: m,
      paramNames: paramNames
    }
  })
}

export function getChangedComponentsInstances (to, from) {
  var records = getRouteRecordWithParamNames(to)
  var r = []
  var parentChange = false
  for (var i = 0; i < records.length; i++ ) {
    var paramNames = records[i].paramNames
    var instances = records[i].routeRecord.instances
    instances = Object.keys(instances).map(function (key) {
      return instances[key]
    })
    if (parentChange) {
      r = [].concat(r, instances)
    } else if (paramNames !== null) {
      for (var pi in paramNames) {
        var name = paramNames[pi]
        if (to.params[name] !== from.params[name]) {
          parentChange = true
          r = [].concat(r, instances)
          break
        }
      }
    }
  }
  return r
}


export function flatMapComponents(route, fn) {
  return Array.prototype.concat.apply([], route.matched.map(function (m, index) {
    return Object.keys(m.components).map(function (key) {
      return fn(m.components[key], m.instances[key], m, key, index)
    })
  }))
}

export async function resolveRouteComponents(route) {
  await Promise.all(
    flatMapComponents(route, async (Component, _, match, key) => {
      // If component is a function, resolve it
      if (typeof Component === 'function' && !Component.options) {
        Component = await Component()
      }
      return match.components[key] = sanitizeComponent(Component)
    })
  )
}

async function getRouteData(route) {
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
      get isServer() {
        console.warn('context.isServer has been deprecated, please use process.server instead.')
        return process.server
      },
      get isClient() {
        console.warn('context.isClient has been deprecated, please use process.client instead.')
        return process.client
      },
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
    app.context.redirect = function (status, path, query) {
      if (!status) return
      app.context._redirected = true // Used in middleware
      // if only 1 or 2 arguments: redirect('/') or redirect('/', { foo: 'bar' })
      if (typeof status === 'string' && (typeof path === 'undefined' || typeof path === 'object')) {
        query = path || {}
        path = status
        status = 302
      }
      app.context.next({
        path: path,
        query: query,
        status: status
      })
    }
    if (process.server) app.context.beforeNuxtRender = (fn) => context.beforeRenderFns.push(fn)
    if (process.client) app.context.nuxtState = window.__NUXT__
  }
  // Dynamic keys
  app.context.next = context.next
  app.context._redirected = false
  app.context._errored = false
  app.context.isHMR = !!context.isHMR
  if (context.route) app.context.route = await getRouteData(context.route)
  app.context.params = app.context.route.params || {}
  app.context.query = app.context.route.query || {}
  if (context.from) app.context.from = await getRouteData(context.from)
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
  return [].slice.call(arguments).join('/').replace(/\/+/g, '/')
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
  return encodeURI(str).replace(/[\/?#]/g, function (c) {
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
  return encodeURI(str).replace(/[?#]/g, function (c) {
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
