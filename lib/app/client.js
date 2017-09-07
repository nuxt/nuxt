import Vue from 'vue'
import middleware from './middleware'
import { createApp, NuxtError } from './index'
import {
  applyAsyncData,
  sanitizeComponent,
  getMatchedComponents,
  getMatchedComponentsInstances,
  flatMapComponents,
  getContext,
  middlewareSeries,
  promisify,
  getLocation,
  compile
} from './utils'

const noopData = () => { return {} }
const noopFetch = () => {}

// Global shared references
let _lastPaths = []
let _lastComponentsFiles = []
let app
let router
<% if (store) { %>let store<% } %>

// Try to rehydrate SSR data from window
const NUXT = window.__NUXT__ || {}

<% if (debug || mode === 'spa') { %>
// Setup global Vue error handler
const defaultErrorHandler = Vue.config.errorHandler
Vue.config.errorHandler = function (err, vm, info) {
  err.statusCode = err.statusCode || err.name || 'Whoops!'
  err.message = err.message || err.toString()

  // Show Nuxt Error Page
  if(vm && vm.$root && vm.$root.$nuxt && vm.$root.$nuxt.error && info !== 'render function') {
    vm.$root.$nuxt.error(err)
  }

  // Call other handler if exist
  if (typeof defaultErrorHandler === 'function') {
    return defaultErrorHandler(...arguments)
  }

  // Log to console
  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  } else {
    console.error(err.message)
  }
}
<% } %>

// Create and mount App
createApp()
.then(mountApp)
.catch(err => {
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
  const componentTransitions = component => {
    const transition = componentOption(component, 'transition', to, from) || {}
    return (typeof transition === 'string' ? { name: transition } : transition)
  }

  return Components.map(Component => {
    // Clone original object to prevent overrides
    const transitions = Object.assign({}, componentTransitions(Component))

    // Combine transitions & prefer `leave` transitions of 'from' route
    if (from && from.matched.length && from.matched[0].components.default) {
      const from_transitions = componentTransitions(from.matched[0].components.default)
      Object.keys(from_transitions)
        .filter(key => from_transitions[key] && key.toLowerCase().indexOf('leave') !== -1)
        .forEach(key => { transitions[key] = from_transitions[key] })
    }

    return transitions
  })
}

async function loadAsyncComponents (to, from, next) {
  // Check if route hash changed
  const fromPath = from.fullPath.split('#')[0]
  const toPath = to.fullPath.split('#')[0]
  this._hashChanged = fromPath === toPath

  <% if (loading) { %>
  if (!this._hashChanged && this.$loading.start) {
      this.$loading.start()
  }
  <% } %>

  try {
    await Promise.all(flatMapComponents(to, (Component, _, match, key) => {
      // If component already resolved
      if (typeof Component !== 'function' || Component.options) {
        const _Component = sanitizeComponent(Component)
        match.components[key] = _Component
        return _Component
      }

      // Resolve component
      return Component().then(Component => {
          const _Component = sanitizeComponent(Component)
          match.components[key] = _Component
          return _Component
      })
    }))

    next()
  } catch (err) {
      if (!err) err = {}
      const statusCode = err.statusCode || err.status || (err.response && err.response.status) || 500
      this.error({ statusCode, message: err.message })
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

  return flatMapComponents(router.match(path), (Component, _, match, key, index) => {
    // If component already resolved
    if (typeof Component !== 'function' || Component.options) {
      const _Component = applySSRData(sanitizeComponent(Component), NUXT.data ? NUXT.data[index] : null)
      match.components[key] = _Component
      return _Component
    }

    // Resolve component
    return Component().then(Component => {
      const _Component = applySSRData(sanitizeComponent(Component), NUXT.data ? NUXT.data[index] : null)
      match.components[key] = _Component
      return _Component
    })
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
    Components.forEach(Component => {
      if (Component.options.middleware) {
        midd = midd.concat(Component.options.middleware)
      }
    })
  }

  midd = midd.map(name => {
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
  if (this._hashChanged) return next()

  // nextCalled is true when redirected
  let nextCalled = false
  const _next = path => {
    <% if(loading) { %>if(this.$loading.finish) this.$loading.finish()<% } %>
    if (nextCalled) return
    nextCalled = true
    next(path)
  }

  // Update context
  const context = getContext({
    to,
    from,
    <% if (store) { %>store,<% } %>
    isClient: true,
    next: _next.bind(this),
    error: this.error.bind(this)
  }, app)
  this._context = context
  this._dateLastError = this.$options._nuxt.dateErr
  this._hadError = !!this.$options._nuxt.err

  // Get route's matched components
  const Components = getMatchedComponents(to)

  // If no Components matched, generate 404
  if (!Components.length) {
    // Default layout
    await callMiddleware.call(this, Components, context)
    if (context._redirected) return

    // Load layout for error page
    const layout = await this.loadLayout(typeof NuxtError.layout === 'function' ? NuxtError.layout(context) : NuxtError.layout)
    await callMiddleware.call(this, Components, context, layout)
    if (context._redirected) return

    this.error({ statusCode: 404, message: '<%= messages.error_404 %>' })
    return next()
  }

  // Update ._data and other properties if hot reloaded
  Components.forEach(Component => {
    if (Component._Ctor && Component._Ctor.options) {
      Component.options.asyncData = Component._Ctor.options.asyncData
      Component.options.fetch = Component._Ctor.options.fetch
    }
  })

  // Apply transitions
  this.setTransitions(mapTransitions(Components, to, from))

  try {
    // Call middleware
    await callMiddleware.call(this, Components, context)
    if (context._redirected) return

    // Set layout
    let layout = Components[0].options.layout
    if (typeof layout === 'function') {
      layout = layout(context)
    }
    layout = await this.loadLayout(layout)

    // Call middleware for layout
    await callMiddleware.call(this, Components, context, layout)
    if (context._redirected) return

    // Call .validate()
    let isValid = true
    Components.forEach(Component => {
      if (!isValid) return
      if (typeof Component.options.validate !== 'function') return
      isValid = Component.options.validate({
        params: to.params || {},
        query : to.query  || {},
        <% if(store) { %>store: context.store <% } %>
      })
    })
    // ...If .validate() returned false
    if (!isValid) {
      this.error({ statusCode: 404, message: '<%= messages.error_404 %>' })
      return next()
    }

    // Call asyncData & fetch hooks on components matched by the route.
    await Promise.all(Components.map((Component, i) => {
      // Check if only children route changed
      Component._path = compile(to.matched[i].path)(to.params)
      if (!this._hadError && this._isMounted && Component._path === _lastPaths[i] && (i + 1) !== Components.length) {
        return Promise.resolve()
      }

      let promises = []

      const hasAsyncData = Component.options.asyncData && typeof Component.options.asyncData === 'function'
      const hasFetch = !!Component.options.fetch
      <% if(loading) { %>const loadingIncrease = (hasAsyncData && hasFetch) ? 30 : 45<% } %>

      // Call asyncData(context)
      if (hasAsyncData) {
        const promise = promisify(Component.options.asyncData, context)
        .then(asyncDataResult => {
          applyAsyncData(Component, asyncDataResult)
          <% if(loading) { %>if(this.$loading.increase) this.$loading.increase(loadingIncrease)<% } %>
        })
        promises.push(promise)
      }

      // Call fetch(context)
      if (hasFetch) {
        let p = Component.options.fetch(context)
        if (!p || (!(p instanceof Promise) && (typeof p.then !== 'function'))) {
            p = Promise.resolve(p)
        }
        p.then(fetchResult => {
          <% if(loading) { %>if(this.$loading.increase) this.$loading.increase(loadingIncrease)<% } %>
        })
        promises.push(p)
      }

      return Promise.all(promises)
    }))

    _lastPaths = Components.map((Component, i) => compile(to.matched[i].path)(to.params))

    <% if(loading) { %>if(this.$loading.finish) this.$loading.finish()<% } %>

    // If not redirected
    if (!nextCalled) next()

  } catch (error) {
    if (!error) error = {}
    _lastPaths = []
    error.statusCode = error.statusCode || error.status || (error.response && error.response.status) || 500

    // Load error layout
    let layout = NuxtError.layout
    if (typeof layout === 'function') {
      layout = layout(context)
    }
    await this.loadLayout(layout)

    this.error(error)
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

// When navigating on a different route but the same component is used, Vue.js
// Will not update the instance data, so we have to update $data ourselves
function fixPrepatch (to, ___) {
  if (this._hashChanged) return

  Vue.nextTick(() => {
    const instances = getMatchedComponentsInstances(to)

    _lastComponentsFiles = instances.map((instance, i) => {
      if (!instance) return '';

      if (_lastPaths[i] === instance.constructor._path && typeof instance.constructor.options.data === 'function') {
        const newData = instance.constructor.options.data.call(instance)
        for (let key in newData) {
          Vue.set(instance.$data, key, newData[key])
        }
      }

      return instance.constructor.options.__file
    })

    // Hide error component if no error
    if (this._hadError && this._dateLastError === this.$options._nuxt.dateErr) {
      this.error()
    }

    // Set layout
    let layout = this.$options._nuxt.err ? NuxtError.layout : to.matched[0].components.default.options.layout
    if (typeof layout === 'function') {
      layout = layout(this._context)
    }
    this.setLayout(layout)

    <% if (isDev) { %>
    // Hot reloading
    setTimeout(() => hotReloadAPI(this), 100)
    <% } %>
  })
}

function nuxtReady (app) {
  window._nuxtReadyCbs.forEach((cb) => {
    if (typeof cb === 'function') {
      cb(app)
    }
  })
  // Special JSDOM
  if (typeof window._onNuxtLoaded === 'function') {
    window._onNuxtLoaded(app)
  }
  // Add router hooks
  router.afterEach(function (to, from) {
    app.$nuxt.$emit('routeChanged', to, from)
  })
}

<% if (isDev) { %>
// Special hot reload with asyncData(context)
function hotReloadAPI (_app) {
  if (!module.hot) return

  let $components = []
  let $nuxt = _app.$nuxt

  while ($nuxt && $nuxt.$children && $nuxt.$children.length) {
    $nuxt.$children.forEach((child, i) => {
      if (child.$vnode.data.nuxtChild) {
        let hasAlready = false
        $components.forEach(component => {
          if (component.$options.__file === child.$options.__file) {
            hasAlready = true
          }
        })
        if (!hasAlready) {
          $components.push(child)
        }
      }
      $nuxt = child
    })
  }

  $components.forEach(addHotReload.bind(_app))
}

function addHotReload ($component, depth) {
  if ($component.$vnode.data._hasHotReload) return
  $component.$vnode.data._hasHotReload = true

  var _forceUpdate = $component.$forceUpdate.bind($component.$parent)

  $component.$vnode.context.$forceUpdate = () => {
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
    let context = getContext({ route: router.currentRoute<%= (store ? ', store' : '') %>, isClient: true, isHMR: true, next: next.bind(this), error: this.error }, app)
    <%= (loading ? 'this.$loading.start && this.$loading.start()' : '') %>
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

  // Load layout
  const layout = NUXT.layout || 'default'
  await _app.loadLayout(layout)
  _app.setLayout(layout)

  // Mounts Vue app to DOM element
  const mountApp = () => {
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
  _app.setTransitions = _app.$options._nuxt.setTransitions.bind(_app)
  if (Components.length) {
    _app.setTransitions(mapTransitions(Components, router.currentRoute))
    _lastPaths = router.currentRoute.matched.map(route => compile(route.path)(router.currentRoute.params))
    _lastComponentsFiles = Components.map(Component => Component.options.__file)
  }

  // Initialize error handler
  _app.error = _app.$options._nuxt.error.bind(_app)
  _app.$loading = {} // To avoid error while _app.$nuxt does not exist
  if (NUXT.error) _app.error(NUXT.error)

  // Add router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))
  router.afterEach(normalizeComponents)
  router.afterEach(fixPrepatch.bind(_app))

  // If page already is server rendered
  if (NUXT.serverRendered) {
    mountApp()
    return
  }

  render.call(_app, router.currentRoute, router.currentRoute, path => {
    if (!path) {
      normalizeComponents(router.currentRoute, router.currentRoute)
      fixPrepatch.call(_app, router.currentRoute, router.currentRoute)
      mountApp()
      return
    }

    // Push the path and then mount app
    let mounted = false
    router.afterEach(() => {
      if (mounted) return
      mounted = true
      mountApp()
    })
    router.push(path)
  })
}
