'use strict'

import Vue from 'vue'
import middleware from './middleware'
import { createApp, NuxtError } from './index'
import { applyAsyncData, sanitizeComponent, getMatchedComponents, getMatchedComponentsInstances, flatMapComponents, getContext, middlewareSeries, promisify, getLocation, compile } from './utils'
const noopData = () => { return {} }
const noopFetch = () => {}
let _lastPaths = []
let _lastComponentsFiles = []

let app
let router
<%= (store ? 'let store' : '') %>

function mapTransitions(Components, to, from) {
  return Components.map((Component) => {
    let transition = Component.options.transition
    if (typeof transition === 'function') {
      return transition(to, from)
    }
    return transition
  })
}

function loadAsyncComponents (to, from, next) {
  const resolveComponents = flatMapComponents(to, (Component, _, match, key) => {
    if (typeof Component === 'function' && !Component.options) {
      return new Promise(function (resolve, reject) {
        const _resolve = (Component) => {
          Component = sanitizeComponent(Component)
          match.components[key] = Component
          resolve(Component)
        }
        Component().then(_resolve).catch(reject)
      })
    }
    Component = sanitizeComponent(Component)
    match.components[key] = Component
    return match.components[key]
  })
  const fromPath = from.fullPath.split('#')[0]
  const toPath = to.fullPath.split('#')[0]
  this._hashChanged = (fromPath === toPath)
  if (!this._hashChanged) {
    <%= (loading ? 'this.$loading.start && this.$loading.start()' : '') %>
  }
  Promise.all(resolveComponents)
  .then(() => next())
  .catch((err) => {
    let statusCode = err.statusCode || err.status || (err.response && err.response.status) || 500
    this.error({ statusCode, message: err.message })
    next(false)
  })
}

function callMiddleware (Components, context, layout) {
  // if layout is undefined, only call global middleware
  let midd = <%= serialize(router.middleware, { isJSON: true }) %>
  let unknownMiddleware = false
  if (typeof layout !== 'undefined') {
    midd = [] // exclude global middleware if layout defined (already called before)
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
  let layout
  let nextCalled = false
  const _next = function (path) {
    <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
    if (nextCalled) return
    nextCalled = true
    next(path)
  }
  let context = getContext({ to<%= (store ? ', store' : '') %>, isClient: true, next: _next.bind(this), error: this.error.bind(this) }, app)
  let Components = getMatchedComponents(to)
  this._context = context
  this._dateLastError = this.$options._nuxt.dateErr
  this._hadError = !!this.$options._nuxt.err
  if (!Components.length) {
    // Default layout
    await callMiddleware.call(this, Components, context)
    if (context._redirected) return
    layout = await this.loadLayout(typeof NuxtError.layout === 'function' ? NuxtError.layout(context) : NuxtError.layout)
    await callMiddleware.call(this, Components, context, layout)
    if (context._redirected) return
    this.error({ statusCode: 404, message: 'This page could not be found.' })
    return next()
  }
  // Update ._data and other properties if hot reloaded
  Components.forEach(function (Component) {
    if (Component._Ctor && Component._Ctor.options) {
      Component.options.asyncData = Component._Ctor.options.asyncData
      Component.options.fetch = Component._Ctor.options.fetch
    }
  })
  this.setTransitions(mapTransitions(Components, to, from))
  try {
    // Set layout
    await callMiddleware.call(this, Components, context)
    if (context._redirected) return
    layout = Components[0].options.layout
    if (typeof layout === 'function') {
      layout = layout(context)
    }
    layout = await this.loadLayout(layout)
    await callMiddleware.call(this, Components, context, layout)
    if (context._redirected) return
    // Pass validation?
    let isValid = true
    Components.forEach((Component) => {
      if (!isValid) return
      if (typeof Component.options.validate !== 'function') return
      isValid = Component.options.validate({
        params: to.params || {},
        query : to.query  || {}<%= (store ? ', store: context.store' : '') %>
      })
    })
    if (!isValid) {
      this.error({ statusCode: 404, message: 'This page could not be found.' })
      return next()
    }
    await Promise.all(Components.map((Component, i) => {
      // Check if only children route changed
      Component._path = compile(to.matched[i].path)(to.params)
      if (!this._hadError && Component._path === _lastPaths[i] && (i + 1) !== Components.length) {
        return Promise.resolve()
      }
      let promises = []
      // asyncData method
      if (Component.options.asyncData && typeof Component.options.asyncData === 'function') {
        var promise = promisify(Component.options.asyncData, context)
        promise.then((asyncDataResult) => {
          applyAsyncData(Component, asyncDataResult)
          <%= (loading ? 'this.$loading.increase && this.$loading.increase(30)' : '') %>
        })
        promises.push(promise)
      }
      if (Component.options.fetch) {
        var p = Component.options.fetch(context)
        if (!p || (!(p instanceof Promise) && (typeof p.then !== 'function'))) { p = Promise.resolve(p) }
        <%= (loading ? 'p.then(() => this.$loading.increase && this.$loading.increase(30))' : '') %>
        promises.push(p)
      }
      return Promise.all(promises)
    }))
    _lastPaths = Components.map((Component, i) => compile(to.matched[i].path)(to.params))
    <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
    // If not redirected
    if (!nextCalled) {
      next()
    }
  } catch (error) {
    _lastPaths = []
    error.statusCode = error.statusCode || error.status || (error.response && error.response.status) || 500
    let layout = NuxtError.layout
    if (typeof layout === 'function') {
      layout = layout(context)
    }
    this.loadLayout(layout)
    .then(() => {
      this.error(error)
      next(false)
    })
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
// will not update the instance data, so we have to update $data ourselves
function fixPrepatch (to, ___) {
  if (this._hashChanged) return
  Vue.nextTick(() => {
    let instances = getMatchedComponentsInstances(to)
    _lastComponentsFiles = instances.map((instance, i) => {
      if (!instance) return '';
      if (_lastPaths[i] === instance.constructor._path && typeof instance.constructor.options.data === 'function') {
        let newData = instance.constructor.options.data.call(instance)
        for (let key in newData) {
          Vue.set(instance.$data, key, newData[key])
        }
      }
      return instance.constructor.options.__file
    })
    // hide error component if no error
    if (this._hadError && this._dateLastError === this.$options._nuxt.dateErr) {
      this.error()
    }
    // Set layout
    let layout = this.$options._nuxt.err ? NuxtError.layout : to.matched[0].components.default.options.layout
    if (typeof layout === 'function') {
      layout = layout(this._context)
    }
    this.setLayout(layout)
    // hot reloading
    setTimeout(() => hotReloadAPI(this), 100)
  })
}

// Special hot reload with asyncData(context)
function hotReloadAPI (_app) {
  if (!module.hot) return
  let $components = []
  let $nuxt = _app.$nuxt
  while ($nuxt && $nuxt.$children && $nuxt.$children.length) {
    $nuxt.$children.forEach(function (child, i) {
      if (child.$vnode.data.nuxtChild) {
        let hasAlready = false
        $components.forEach(function (component) {
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
    let context = getContext({ route: router.currentRoute<%= (store ? ', store' : '') %>, isClient: true, hotReload: true, next: next.bind(this), error: this.error }, app)
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

// Load vue app
const NUXT = window.__NUXT__ || {}
if (!NUXT) {
  throw new Error('[nuxt.js] cannot find the global variable __NUXT__, make sure the server is working.')
}
// Get matched components
const resolveComponents = function (router) {
  const path = getLocation(router.options.base)
  return flatMapComponents(router.match(path), (Component, _, match, key, index) => {
    if (typeof Component === 'function' && !Component.options) {
      return new Promise(function (resolve, reject) {
        const _resolve = (Component) => {
          Component = sanitizeComponent(Component)
          if (NUXT.serverRendered) {
            applyAsyncData(Component, NUXT.data[index])
          }
          match.components[key] = Component
          resolve(Component)
        }
        Component().then(_resolve).catch(reject)
      })
    }
    Component = sanitizeComponent(Component)
    match.components[key] = Component
    return Component
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

createApp()
.then(async (__app) => {
  app = __app.app
  router = __app.router
  <%= (store ? 'store = __app.store' : '') %>
  const Components = await Promise.all(resolveComponents(router))
  const _app = new Vue(app)
  const layout = NUXT.layout || 'default'
  await _app.loadLayout(layout)
  _app.setLayout(layout)
  const mountApp = () => {
    _app.$mount('#__nuxt')
    Vue.nextTick(() => {
      // Hot reloading
      hotReloadAPI(_app)
      // Call window.onNuxtReady callbacks
      nuxtReady(_app)
    })
  }
  _app.setTransitions = _app.$options._nuxt.setTransitions.bind(_app)
  if (Components.length) {
    _app.setTransitions(mapTransitions(Components, router.currentRoute))
    _lastPaths = router.currentRoute.matched.map((route) => compile(route.path)(router.currentRoute.params))
    _lastComponentsFiles = Components.map((Component) => Component.options.__file)
  }
  _app.error = _app.$options._nuxt.error.bind(_app)
  _app.$loading = {} // to avoid error while _app.$nuxt does not exist
  if (NUXT.error) _app.error(NUXT.error)
  // Add router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))
  router.afterEach(normalizeComponents)
  router.afterEach(fixPrepatch.bind(_app))
  if (NUXT.serverRendered) {
    mountApp()
    return
  }
  render.call(_app, router.currentRoute, router.currentRoute, function (path) {
    if (path) {
      let mounted = false
      router.afterEach(function () {
        if (mounted) return
        mounted = true
        mountApp()
      })
      router.push(path)
      return
    }
    normalizeComponents(router.currentRoute, router.currentRoute)
    fixPrepatch.call(_app, router.currentRoute, router.currentRoute)
    mountApp()
  })
})
.catch((err) => {
  console.error('[nuxt.js] Cannot load components', err) // eslint-disable-line no-console
})
