import Vue from 'vue'
import middleware from './middleware'
import { createApp, NuxtError } from './index'
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
} from './utils'

const noopData = () => { return {} }
const noopFetch = () => {}

// Global shared references
let _lastPaths = []
let app
let router
<% if (store) { %>let store<% } %>

// Try to rehydrate SSR data from window
const NUXT = window.__NUXT__ || {}

Object.assign(Vue.config, <%= serialize(vue.config) %>)

<% if (debug || mode === 'spa') { %>
// Setup global Vue error handler
const defaultErrorHandler = Vue.config.errorHandler
Vue.config.errorHandler = (err, vm, info, ...rest) => {
  const nuxtError = {
    statusCode: err.statusCode || err.name || 'Whoops!',
    message: err.message || err.toString()
  }

  // Call other handler if exist
  let handled = null
  if (typeof defaultErrorHandler === 'function') {
    handled = defaultErrorHandler(err, vm, info, ...rest)
  }
  if (handled === true){
    return handled
  }

  // Show Nuxt Error Page
  if (vm && vm.$root && vm.$root.$nuxt && vm.$root.$nuxt.error && info !== 'render function') {
    vm.$root.$nuxt.error(nuxtError)
  }
  if (typeof defaultErrorHandler === 'function') {
    return handled
  }

  // Log to console
  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  } else {
    console.error(err.message || nuxtError.message)
  }
}
<% } %>

// Create and mount App
createApp()
.then(mountApp)
.catch((err) => {
  console.error('[nuxt] Error while initializing app', err)
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
      const from_transitions = componentTransitions(from.matched[0].components.default)
      Object.keys(from_transitions)
        .filter((key) => from_transitions[key] && key.toLowerCase().indexOf('leave') !== -1)
        .forEach((key) => { transitions[key] = from_transitions[key] })
    }

    return transitions
  })
}

async function loadAsyncComponents (to, from, next) {
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
          return watchQuery.some((key) => this._diffQuery[key])
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
  } catch (err) {
    err = err || {}
    const statusCode = (err.statusCode || err.status || (err.response && err.response.status) || 500)
    this.error({ statusCode, message: err.message })
    this.$nuxt.$emit('routeChanged', to, from, err)
    next(false)
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

function callMiddleware (Components, context, layout) {
  let midd = <%= serialize(router.middleware, { isJSON: true }) %>
  let unknownMiddleware = false

  // If layout is undefined, only call global middleware
  if (typeof layout !== 'undefined') {
    midd = [] // Exclude global middleware if layout defined (already called before)
    if (layout.middleware) {
      midd = midd.concat(layout.middleware)
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

async function render (to, from, next) {
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
      if (this._pathChanged && this._queryChanged || Component._path !== _lastPaths[i]) {
        Component._dataRefresh = true
      } else if (!this._pathChanged && this._queryChanged) {
        const watchQuery = Component.options.watchQuery
        if (watchQuery === true) {
          Component._dataRefresh = true
        } else if (Array.isArray(watchQuery)) {
          Component._dataRefresh = watchQuery.some((key) => this._diffQuery[key])
        }
      }
      if (!this._hadError && this._isMounted && !Component._dataRefresh) {
        return Promise.resolve()
      }

      let promises = []

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
            if(this.$loading.increase) {
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

  } catch (error) {
    if (!error) {
      error = {}
    } else if (error.message === 'ERR_REDIRECT') {
      return this.$nuxt.$emit('routeChanged', to, from, error)
    }
    _lastPaths = []
    const errorResponseStatus = (error.response && error.response.status)
    error.statusCode = error.statusCode || error.status || errorResponseStatus || 500

    globalHandleError(error)

    // Load error layout
    let layout = NuxtError.layout
    if (typeof layout === 'function') {
      layout = layout(app.context)
    }
    await this.loadLayout(layout)

    this.error(error)
    this.$nuxt.$emit('routeChanged', to, from, error)
    next(false)
  }
}

// Fix components format in matched, it's due to code-splitting of vue-router
function normalizeComponents (to, ___) {
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
        typeof instance.constructor.options.data === 'function'
      ) {
        const newData = instance.constructor.options.data.call(instance)
        for (let key in newData) {
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

function nuxtReady (_app) {
  window._nuxtReadyCbs.forEach((cb) => {
    if (typeof cb === 'function') {
      cb(_app)
    }
  })
  // Special JSDOM
  if (typeof window._onNuxtLoaded === 'function') {
    window._onNuxtLoaded(_app)
  }
  // Add router hooks
  router.afterEach((to, from) => {
    // Wait for fixPrepatch + $data updates
    Vue.nextTick(() => _app.$nuxt.$emit('routeChanged', to, from))
  })
}

<% if (isDev) { %>
// Special hot reload with asyncData(context)
function getNuxtChildComponents($parent, $components = []) {
  $parent.$children.forEach(($child) => {
    if ($child.$vnode.data.nuxtChild && !$components.find(c =>(c.$options.__file === $child.$options.__file))) {
      $components.push($child)
    }
    if ($child.$children && $child.$children.length) {
      getNuxtChildComponents($child, $components)
    }
  })

  return $components
}

function hotReloadAPI (_app) {
  if (!module.hot) return

  let $components = getNuxtChildComponents(_app.$nuxt, [])

  $components.forEach(addHotReload.bind(_app))
}

function addHotReload ($component, depth) {
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
  <% if (store) { %>store = __app.store <% } %>

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
    _app.$mount('#__nuxt')

    // Listen for first Vue update
    Vue.nextTick(() => {
      // Call window.onNuxtReady callbacks
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

  // Add router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))
  router.afterEach(normalizeComponents)
  router.afterEach(fixPrepatch.bind(_app))

  // If page already is server rendered
  if (NUXT.serverRendered) {
    mount()
    return
  }

  // First render on client-side
  render.call(_app, router.currentRoute, router.currentRoute, (path) => {
    // If not redirected
    if (!path) {
      normalizeComponents(router.currentRoute, router.currentRoute)
      showNextPage.call(_app, router.currentRoute)
      // Dont call fixPrepatch.call(_app, router.currentRoute, router.currentRoute) since it's first render
      mount()
      return
    }

    // Push the path and then mount app
    router.push(path, () => mount(), (err) => {
      if (!err) return mount()
      console.error(err)
    })
  })
}
