import Vue from 'vue'
<% if (fetch.client) { %>import fetch from 'unfetch'<% } %>
import middleware from './middleware.js'
import {
  applyAsyncData,
  sanitizeComponent,
  resolveRouteComponents,
  getMatchedComponents,
  getMatchedComponentsInstances,
  flatMapComponents,
  setContext,
  middlewareSeries,
  promisify,
  getLocation,
  compile,
  getQueryDiff,
  globalHandleError
} from './utils.js'
import { createApp, NuxtError } from './index.js'
import NuxtLink from './components/nuxt-link.<%= router.prefetchLinks ? "client" : "server" %>.js' // should be included after ./index.js

// Component: <NuxtLink>
Vue.component(NuxtLink.name, NuxtLink)
Vue.component('NLink', NuxtLink)

<% if (fetch.client) { %>if (!global.fetch) { global.fetch = fetch }<% } %>

// Global shared references
let _lastPaths = []
let app
let router
<% if (store) { %>let store<%= isTest ? '// eslint-disable-line no-unused-vars' : '' %><% } %>

// Try to rehydrate SSR data from window
const NUXT = window.<%= globals.context %> || {}

Object.assign(Vue.config, <%= serialize(vue.config) %>)<%= isTest ? '// eslint-disable-line' : '' %>

<% if (debug) { %>
// Setup global Vue error handler
if (!Vue.config.$nuxt) {
  const defaultErrorHandler = Vue.config.errorHandler
  Vue.config.errorHandler = (err, vm, info, ...rest) => {
    // Call other handler if exist
    let handled = null
    if (typeof defaultErrorHandler === 'function') {
      handled = defaultErrorHandler(err, vm, info, ...rest)
    }
    if (handled === true) {
      return handled
    }

    if (vm && vm.$root) {
      const nuxtApp = Object.keys(Vue.config.$nuxt)
        .find(nuxtInstance => vm.$root[nuxtInstance])

      // Show Nuxt Error Page
      if (nuxtApp && vm.$root[nuxtApp].error && info !== 'render function') {
        vm.$root[nuxtApp].error(err)
      }
    }

    if (typeof defaultErrorHandler === 'function') {
      return handled
    }

    // Log to console
    if (process.env.NODE_ENV !== 'production') {
      console.error(err)
    } else {
      console.error(err.message || err)
    }
  }
  Vue.config.$nuxt = {}
}
Vue.config.$nuxt.<%= globals.nuxt %> = true
<% } %>
const errorHandler = Vue.config.errorHandler || console.error

// Create and mount App
createApp()
  .then(mountApp)
  .catch((err) => {
    const wrapperError = new Error(err)
    wrapperError.message = '[nuxt] Error while mounting app: ' + wrapperError.message
    errorHandler(wrapperError)
  })

function componentOption(component, key, ...args) {
  if (!component || !component.options || !component.options[key]) {
    return {}
  }
  const option = component.options[key]
  if (typeof option === 'function') {
    return option(...args)
  }
  return option
}

function mapTransitions(Components, to, from) {
  const componentTransitions = (component) => {
    const transition = componentOption(component, 'transition', to, from) || {}
    return (typeof transition === 'string' ? { name: transition } : transition)
  }

  return Components.map((Component) => {
    // Clone original object to prevent overrides
    const transitions = Object.assign({}, componentTransitions(Component))

    // Combine transitions & prefer `leave` transitions of 'from' route
    if (from && from.matched.length && from.matched[0].components.default) {
      const fromTransitions = componentTransitions(from.matched[0].components.default)
      Object.keys(fromTransitions)
        .filter(key => fromTransitions[key] && key.toLowerCase().includes('leave'))
        .forEach((key) => { transitions[key] = fromTransitions[key] })
    }

    return transitions
  })
}

async function loadAsyncComponents(to, from, next) {
  // Check if route path changed (this._pathChanged), only if the page is not an error (for validate())
  this._pathChanged = !!app.nuxt.err || from.path !== to.path
  this._queryChanged = JSON.stringify(to.query) !== JSON.stringify(from.query)
  this._diffQuery = (this._queryChanged ? getQueryDiff(to.query, from.query) : [])

  <% if (loading) { %>
  if (this._pathChanged && this.$loading.start && !this.$loading.manual) {
    this.$loading.start()
  }
  <% } %>

  try {
    const Components = await resolveRouteComponents(to)
    <% if (loading) { %>
    if (!this._pathChanged && this._queryChanged) {
      // Add a marker on each component that it needs to refresh or not
      const startLoader = Components.some((Component) => {
        const watchQuery = Component.options.watchQuery
        if (watchQuery === true) return true
        if (Array.isArray(watchQuery)) {
          return watchQuery.some(key => this._diffQuery[key])
        }
        return false
      })
      if (startLoader && this.$loading.start && !this.$loading.manual) {
        this.$loading.start()
      }
    }
    <% } %>
    // Call next()
    next()
  } catch (error) {
    const err = error || {}
    const statusCode = err.statusCode || err.status || (err.response && err.response.status) || 500
    const message = err.message || ''

    // Handle chunk loading errors
    // This may be due to a new deployment or a network problem
    if (/^Loading( CSS)? chunk (\d)+ failed\./.test(message)) {
      window.location.reload(true /* skip cache */)
      return // prevent error page blinking for user
    }

    this.error({ statusCode, message })
    this.<%= globals.nuxt %>.$emit('routeChanged', to, from, err)
    next()
  }
}

function applySSRData(Component, ssrData) {
  if (NUXT.serverRendered && ssrData) {
    applyAsyncData(Component, ssrData)
  }
  Component._Ctor = Component
  return Component
}

// Get matched components
function resolveComponents(router) {
  const path = getLocation(router.options.base, router.options.mode)

  return flatMapComponents(router.match(path), async (Component, _, match, key, index) => {
    // If component is not resolved yet, resolve it
    if (typeof Component === 'function' && !Component.options) {
      Component = await Component()
    }
    // Sanitize it and save it
    const _Component = applySSRData(sanitizeComponent(Component), NUXT.data ? NUXT.data[index] : null)
    match.components[key] = _Component
    return _Component
  })
}

function callMiddleware(Components, context, layout) {
  let midd = <%= devalue(router.middleware) %><%= isTest ? '// eslint-disable-line' : '' %>
  let unknownMiddleware = false

  // If layout is undefined, only call global middleware
  if (typeof layout !== 'undefined') {
    midd = [] // Exclude global middleware if layout defined (already called before)
    layout = sanitizeComponent(layout)
    if (layout.options.middleware) {
      midd = midd.concat(layout.options.middleware)
    }
    Components.forEach((Component) => {
      if (Component.options.middleware) {
        midd = midd.concat(Component.options.middleware)
      }
    })
  }

  midd = midd.map((name) => {
    if (typeof name === 'function') return name
    if (typeof middleware[name] !== 'function') {
      unknownMiddleware = true
      this.error({ statusCode: 500, message: 'Unknown middleware ' + name })
    }
    return middleware[name]
  })

  if (unknownMiddleware) return
  return middlewareSeries(midd, context)
}

async function render(to, from, next) {
  if (this._pathChanged === false && this._queryChanged === false) return next()
  // Handle first render on SPA mode
  if (to === from) _lastPaths = []
  else {
    const fromMatches = []
    _lastPaths = getMatchedComponents(from, fromMatches).map((Component, i) => {
      return compile(from.matched[fromMatches[i]].path)(from.params)
    })
  }

  // nextCalled is true when redirected
  let nextCalled = false
  const _next = (path) => {
    <% if (loading) { %>
    if (from.path === path.path && this.$loading.finish) {
      this.$loading.finish()
    }
    <% } %>
    <% if (loading) { %>
    if (from.path !== path.path && this.$loading.pause) {
      this.$loading.pause()
    }
    <% } %>
    if (nextCalled) return
    nextCalled = true
    next(path)
  }

  // Update context
  await setContext(app, {
    route: to,
    from,
    next: _next.bind(this)
  })
  this._dateLastError = app.nuxt.dateErr
  this._hadError = !!app.nuxt.err

  // Get route's matched components
  const matches = []
  const Components = getMatchedComponents(to, matches)

  // If no Components matched, generate 404
  if (!Components.length) {
    // Default layout
    await callMiddleware.call(this, Components, app.context)
    if (nextCalled) return
    // Load layout for error page
    const layout = await this.loadLayout(
      typeof NuxtError.layout === 'function'
        ? NuxtError.layout(app.context)
        : NuxtError.layout
    )
    await callMiddleware.call(this, Components, app.context, layout)
    if (nextCalled) return
    // Show error page
    app.context.error({ statusCode: 404, message: `<%= messages.error_404 %>` })
    return next()
  }

  // Update ._data and other properties if hot reloaded
  Components.forEach((Component) => {
    if (Component._Ctor && Component._Ctor.options) {
      Component.options.asyncData = Component._Ctor.options.asyncData
      Component.options.fetch = Component._Ctor.options.fetch
    }
  })

  // Apply transitions
  this.setTransitions(mapTransitions(Components, to, from))

  try {
    // Call middleware
    await callMiddleware.call(this, Components, app.context)
    if (nextCalled) return
    if (app.context._errored) return next()

    // Set layout
    let layout = Components[0].options.layout
    if (typeof layout === 'function') {
      layout = layout(app.context)
    }
    layout = await this.loadLayout(layout)

    // Call middleware for layout
    await callMiddleware.call(this, Components, app.context, layout)
    if (nextCalled) return
    if (app.context._errored) return next()

    // Call .validate()
    let isValid = true
    try {
      for (const Component of Components) {
        if (typeof Component.options.validate !== 'function') {
          continue
        }

        isValid = await Component.options.validate(app.context)

        if (!isValid) {
          break
        }
      }
    } catch (validationError) {
      // ...If .validate() threw an error
      this.error({
        statusCode: validationError.statusCode || '500',
        message: validationError.message
      })
      return next()
    }

    // ...If .validate() returned false
    if (!isValid) {
      this.error({ statusCode: 404, message: `<%= messages.error_404 %>` })
      return next()
    }

    // Call asyncData & fetch hooks on components matched by the route.
    await Promise.all(Components.map((Component, i) => {
      // Check if only children route changed
      Component._path = compile(to.matched[matches[i]].path)(to.params)
      Component._dataRefresh = false
      // Check if Component need to be refreshed (call asyncData & fetch)
      // Only if its slug has changed or is watch query changes
      if ((this._pathChanged && this._queryChanged) || Component._path !== _lastPaths[i]) {
        Component._dataRefresh = true
      } else if (!this._pathChanged && this._queryChanged) {
        const watchQuery = Component.options.watchQuery
        if (watchQuery === true) {
          Component._dataRefresh = true
        } else if (Array.isArray(watchQuery)) {
          Component._dataRefresh = watchQuery.some(key => this._diffQuery[key])
        }
      }
      if (!this._hadError && this._isMounted && !Component._dataRefresh) {
        return Promise.resolve()
      }

      const promises = []

      const hasAsyncData = (
        Component.options.asyncData &&
        typeof Component.options.asyncData === 'function'
      )
      const hasFetch = !!Component.options.fetch
      <% if (loading) { %>
      const loadingIncrease = (hasAsyncData && hasFetch) ? 30 : 45
      <% } %>

      // Call asyncData(context)
      if (hasAsyncData) {
        const promise = promisify(Component.options.asyncData, app.context)
          .then((asyncDataResult) => {
            applyAsyncData(Component, asyncDataResult)
            <% if (loading) { %>
            if (this.$loading.increase) {
              this.$loading.increase(loadingIncrease)
            }
            <% } %>
          })
        promises.push(promise)
      }

      // Check disabled page loading
      this.$loading.manual = Component.options.loading === false

      // Call fetch(context)
      if (hasFetch) {
        let p = Component.options.fetch(app.context)
        if (!p || (!(p instanceof Promise) && (typeof p.then !== 'function'))) {
          p = Promise.resolve(p)
        }
        p.then((fetchResult) => {
          <% if (loading) { %>
          if (this.$loading.increase) {
            this.$loading.increase(loadingIncrease)
          }
          <% } %>
        })
        promises.push(p)
      }

      return Promise.all(promises)
    }))

    // If not redirected
    if (!nextCalled) {
      <% if (loading) { %>
      if (this.$loading.finish && !this.$loading.manual) {
        this.$loading.finish()
      }
      <% } %>
      next()
    }

  } catch (err) {
    const error = err || {}
    if (error.message === 'ERR_REDIRECT') {
      return this.<%= globals.nuxt %>.$emit('routeChanged', to, from, error)
    }
    _lastPaths = []

    globalHandleError(error)

    // Load error layout
    let layout = NuxtError.layout
    if (typeof layout === 'function') {
      layout = layout(app.context)
    }
    await this.loadLayout(layout)

    this.error(error)
    this.<%= globals.nuxt %>.$emit('routeChanged', to, from, error)
    next()
  }
}

// Fix components format in matched, it's due to code-splitting of vue-router
function normalizeComponents(to, ___) {
  flatMapComponents(to, (Component, _, match, key) => {
    if (typeof Component === 'object' && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component)
      Component._Ctor = Component
      match.components[key] = Component
    }
    return Component
  })
}

function showNextPage(to) {
  // Hide error component if no error
  if (this._hadError && this._dateLastError === this.$options.nuxt.dateErr) {
    this.error()
  }

  // Set layout
  let layout = this.$options.nuxt.err
    ? NuxtError.layout
    : to.matched[0].components.default.options.layout

  if (typeof layout === 'function') {
    layout = layout(app.context)
  }
  this.setLayout(layout)
}

// When navigating on a different route but the same component is used, Vue.js
// Will not update the instance data, so we have to update $data ourselves
function fixPrepatch(to, ___) {
  if (this._pathChanged === false && this._queryChanged === false) return

  Vue.nextTick(() => {
    const matches = []
    const instances = getMatchedComponentsInstances(to, matches)
    const Components = getMatchedComponents(to, matches)

    instances.forEach((instance, i) => {
      if (!instance) return
      // if (
      //   !this._queryChanged &&
      //   to.matched[matches[i]].path.indexOf(':') === -1 &&
      //   to.matched[matches[i]].path.indexOf('*') === -1
      // ) return // If not a dynamic route, skip
      if (
        instance.constructor._dataRefresh &&
        Components[i] === instance.constructor &&
        instance.$vnode.data.keepAlive !== true &&
        typeof instance.constructor.options.data === 'function'
      ) {
        const newData = instance.constructor.options.data.call(instance)
        for (const key in newData) {
          Vue.set(instance.$data, key, newData[key])
        }
      }
    })
    showNextPage.call(this, to)
    <% if (isDev) { %>
    // Hot reloading
    setTimeout(() => hotReloadAPI(this), 100)
    <% } %>
  })
}

function nuxtReady(_app) {
  window.<%= globals.readyCallback %>Cbs.forEach((cb) => {
    if (typeof cb === 'function') {
      cb(_app)
    }
  })
  // Special JSDOM
  if (typeof window.<%= globals.loadedCallback %> === 'function') {
    window.<%= globals.loadedCallback %>(_app)
  }
  // Add router hooks
  router.afterEach((to, from) => {
    // Wait for fixPrepatch + $data updates
    Vue.nextTick(() => _app.<%= globals.nuxt %>.$emit('routeChanged', to, from))
  })
}

<% if (isDev) { %>
const noopData = () => { return {} }
const noopFetch = () => {}

// Special hot reload with asyncData(context)
function getNuxtChildComponents($parent, $components = []) {
  $parent.$children.forEach(($child) => {
    if ($child.$vnode && $child.$vnode.data.nuxtChild && !$components.find(c =>(c.$options.__file === $child.$options.__file))) {
      $components.push($child)
    }
    if ($child.$children && $child.$children.length) {
      getNuxtChildComponents($child, $components)
    }
  })

  return $components
}

function hotReloadAPI(_app) {
  if (!module.hot) return

  let $components = getNuxtChildComponents(_app.<%= globals.nuxt %>, [])

  $components.forEach(addHotReload.bind(_app))
}

function addHotReload($component, depth) {
  if ($component.$vnode.data._hasHotReload) return
  $component.$vnode.data._hasHotReload = true

  var _forceUpdate = $component.$forceUpdate.bind($component.$parent)

  $component.$vnode.context.$forceUpdate = async () => {
    let Components = getMatchedComponents(router.currentRoute)
    let Component = Components[depth]
    if (!Component) return _forceUpdate()
    if (typeof Component === 'object' && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component)
      Component._Ctor = Component
    }
    this.error()
    let promises = []
    const next = function (path) {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      router.push(path)
    }
    await setContext(app, {
      route: router.currentRoute,
      isHMR: true,
      next: next.bind(this)
    })
    const context = app.context
    <% if (loading) { %>
    if (this.$loading.start && !this.$loading.manual) this.$loading.start()
    <% } %>
    callMiddleware.call(this, Components, context)
    .then(() => {
      // If layout changed
      if (depth !== 0) return Promise.resolve()
      let layout = Component.options.layout || 'default'
      if (typeof layout === 'function') {
        layout = layout(context)
      }
      if (this.layoutName === layout) return Promise.resolve()
      let promise = this.loadLayout(layout)
      promise.then(() => {
        this.setLayout(layout)
        Vue.nextTick(() => hotReloadAPI(this))
      })
      return promise
    })
    .then(() => {
      return callMiddleware.call(this, Components, context, this.layout)
    })
    .then(() => {
      // Call asyncData(context)
      let pAsyncData = promisify(Component.options.asyncData || noopData, context)
      pAsyncData.then((asyncDataResult) => {
        applyAsyncData(Component, asyncDataResult)
        <%= (loading ? 'this.$loading.increase && this.$loading.increase(30)' : '') %>
      })
      promises.push(pAsyncData)
      // Call fetch()
      Component.options.fetch = Component.options.fetch || noopFetch
      let pFetch = Component.options.fetch(context)
      if (!pFetch || (!(pFetch instanceof Promise) && (typeof pFetch.then !== 'function'))) { pFetch = Promise.resolve(pFetch) }
      <%= (loading ? 'pFetch.then(() => this.$loading.increase && this.$loading.increase(30))' : '') %>
      promises.push(pFetch)
      return Promise.all(promises)
    })
    .then(() => {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      _forceUpdate()
      setTimeout(() => hotReloadAPI(this), 100)
    })
  }
}
<% } %>

async function mountApp(__app) {
  // Set global variables
  app = __app.app
  router = __app.router
  <% if (store) { %>store = __app.store<% } %>

  // Resolve route components
  const Components = await Promise.all(resolveComponents(router))

  // Create Vue instance
  const _app = new Vue(app)

  <% if (mode !== 'spa') { %>
  // Load layout
  const layout = NUXT.layout || 'default'
  await _app.loadLayout(layout)
  _app.setLayout(layout)
  <% } %>

  // Mounts Vue app to DOM element
  const mount = () => {
    _app.$mount('#<%= globals.id %>')

    // Add afterEach router hooks
    router.afterEach(normalizeComponents)
    router.afterEach(fixPrepatch.bind(_app))

    // Listen for first Vue update
    Vue.nextTick(() => {
      // Call window.{{globals.readyCallback}} callbacks
      nuxtReady(_app)
      <% if (isDev) { %>
      // Enable hot reloading
      hotReloadAPI(_app)
      <% } %>
    })
  }

  // Enable transitions
  _app.setTransitions = _app.$options.nuxt.setTransitions.bind(_app)
  if (Components.length) {
    _app.setTransitions(mapTransitions(Components, router.currentRoute))
    _lastPaths = router.currentRoute.matched.map(route => compile(route.path)(router.currentRoute.params))
  }

  // Initialize error handler
  _app.$loading = {} // To avoid error while _app.$nuxt does not exist
  if (NUXT.error) _app.error(NUXT.error)

  // Add beforeEach router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))

  // If page already is server rendered
  if (NUXT.serverRendered) {
    mount()
    return
  }

  // First render on client-side
  const clientFirstMount = () => {
    normalizeComponents(router.currentRoute, router.currentRoute)
    showNextPage.call(_app, router.currentRoute)
    // Don't call fixPrepatch.call(_app, router.currentRoute, router.currentRoute) since it's first render
    mount()
  }

  render.call(_app, router.currentRoute, router.currentRoute, (path) => {
    // If not redirected
    if (!path) {
      clientFirstMount()
      return
    }

    // Add a one-time afterEach hook to
    // mount the app wait for redirect and route gets resolved
    const unregisterHook = router.afterEach((to, from) => {
      unregisterHook()
      clientFirstMount()
    })

    // Push the path and let route to be resolved
    router.push(path, undefined, (err) => {
      if (err) errorHandler(err)
    })
  })
}
