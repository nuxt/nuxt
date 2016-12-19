'use strict'

require('es6-object-assign').polyfill()
import 'es6-promise/auto'
import Vue from 'vue'
import { app, router<%= (store ? ', store' : '') %> } from './index'
import { getMatchedComponents, getMatchedComponentsInstances, flatMapComponents, getContext, promisify, getLocation, compile } from './utils'
const noopData = () => { return {} }
const noopFetch = () => {}
let _lastPaths = []

function mapTransitions(Components, to, from) {
  return Components.map((Component) => {
    let transition = Component.options.transition
    if (typeof transition === 'function') {
      return transition(to, from)
    }
    return transition
  })
}

function loadAsyncComponents (to, ___, next) {
  const resolveComponents = flatMapComponents(to, (Component, _, match, key) => {
    if (typeof Component === 'function' && !Component.options) {
      return new Promise(function (resolve, reject) {
        const _resolve = (Component) => {
          if (!Component.options) {
            Component = Vue.extend(Component) // fix issue #6
            Component._Ctor = Component
          } else {
           Component._Ctor = Component
           Component.extendOptions = Component.options
          }
          match.components[key] = Component
          resolve(Component)
        }
        Component().then(_resolve).catch(reject)
      })
    }
    if (typeof Component === 'object' && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component)
      Component._Ctor = Component
      match.components[key] = Component
    }
    return Component
  })
  <%= (loading ? 'this.$loading.start && this.$loading.start()' : '') %>
  Promise.all(resolveComponents)
  .then(() => next())
  .catch((err) => {
    this.error({ statusCode: 500, message: err.message })
    next(false)
  })
}

function render (to, from, next) {
  let Components = getMatchedComponents(to)
  if (!Components.length) {
    this.error({ statusCode: 404, message: 'This page could not be found.', url: to.path })
    return next()
  }
  // Update ._data and other properties if hot reloaded
  Components.forEach(function (Component) {
    if (!Component._data) {
      Component._data = Component.options.data || noopData
    }
    if (Component._Ctor && Component._Ctor.options && Component._dataFn) {
      Component.options.fetch = Component._Ctor.options.fetch
      const originalDataFn = Component._data.toString().replace(/\s/g, '')
      const dataFn = Component._dataFn
      const newDataFn = (Component._Ctor.options.data || noopData).toString().replace(/\s/g, '')
      // If component data method changed
      if (newDataFn !== originalDataFn && newDataFn !== dataFn) {
        Component._data = Component._Ctor.options.data || noopData
      }
    }
  })
  this.setTransitions(mapTransitions(Components, to, from))
  this.error()
  let nextCalled = false
  let isValid = Components.some((Component) => {
    if (typeof Component.options.validate !== 'function') return true
    return Component.options.validate({
      params: to.params || {},
      query: to.query || {}
    })
  })
  if (!isValid) {
    this.error({ statusCode: 404, message: 'This page could not be found.', url: to.path })
    return next()
  }
  Promise.all(Components.map((Component, i) => {
    // Check if only children route changed
    Component._path = compile(to.matched[i].path)(to.params)
    if (Component._path === _lastPaths[i] && (i + 1) !== Components.length) {
      return Promise.resolve()
    }
    let promises = []
    const _next = function (path) {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      nextCalled = true
      next(path)
    }
    const context = getContext({ to<%= (store ? ', store' : '') %>, isClient: true, next: _next.bind(this), error: this.error.bind(this) })
    // Validate method
    if (Component._data && typeof Component._data === 'function') {
      var promise = promisify(Component._data, context)
      promise.then((data) => {
        Component.options.data = () => data || {}
        Component._dataFn = Component.options.data.toString().replace(/\s/g, '')
        if (Component._Ctor && Component._Ctor.options) {
          Component._Ctor.options.data = Component.options.data
        }
        <%= (loading ? 'this.$loading.increase && this.$loading.increase(30)' : '') %>
      })
      promises.push(promise)
    }
    if (Component.options.fetch) {
      var p = Component.options.fetch(context)
      if (!(p instanceof Promise)) { p = Promise.resolve(p) }
      <%= (loading ? 'p.then(() => this.$loading.increase && this.$loading.increase(30))' : '') %>
      promises.push(p)
    }
    return Promise.all(promises)
  }))
  .then(() => {
    _lastPaths = Components.map((Component, i) => compile(to.matched[i].path)(to.params))
    <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
    // If not redirected
    if (!nextCalled) {
      next()
    }
  })
  .catch((error) => {
    _lastPaths = []
    this.error(error)
    next(false)
  })
}

// When navigating on a different route but the same component is used, Vue.js
// will not update the instance data, so we have to update $data ourselves
function fixPrepatch (to, ___) {
  if (!this.$nuxt._routerViewCache || !this.$nuxt._routerViewCache.default) {
    return
  }
  Vue.nextTick(() => {
    let instances = getMatchedComponentsInstances(to)
    instances.forEach((instance) => {
      if (!instance) return;
      let file = instance.$parent._routerViewCache.default.__file
      if (typeof instance.$parent._routerViewCache.default === 'function') {
        file = instance.$parent._routerViewCache.default.options.__file
      }
      if (instance.constructor.options.__file === file) {
        let newData = instance.constructor.options.data()
        for (let key in newData) {
          Vue.set(instance.$data, key, newData[key])
        }
      }
    })
  })
}

// Special hot reload with data(context)
function hotReloadAPI (_app) {
  const $nuxt = _app.$nuxt
  var _forceUpdate = $nuxt.$forceUpdate.bind($nuxt)
  $nuxt.$forceUpdate = function () {
    let Component = getMatchedComponents(router.currentRoute)[0]
    if (!Component) return _forceUpdate()
    if (typeof Component === 'object' && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component)
      Component._Ctor = Component
    }
    let promises = []
    const next = function (path) {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      router.push(path)
    }
    const context = getContext({ route: router.currentRoute<%= (store ? ', store' : '') %>, isClient: true, next: next.bind(this), error: _app.error })
    // Check if data has been updated
    const originalDataFn = (Component._data || noopData).toString().replace(/\s/g, '')
    const newDataFn = (Component._Ctor.options.data || noopData).toString().replace(/\s/g, '')
    if (originalDataFn !== newDataFn) {
      Component._data = Component._Ctor.options.data || noopData
      let p = promisify(Component._data, context)
      p.then((data) => {
        Component.options.data = () => data || {}
        Component._dataFn = Component.options.data.toString().replace(/\s/g, '')
        Component._Ctor.options.data = Component.options.data
        <%= (loading ? 'this.$loading.increase && this.$loading.increase(30)' : '') %>
      })
      promises.push(p)
    }
    // Check if fetch has been updated
    const originalFetchFn = (Component.options.fetch || noopFetch).toString().replace(/\s/g, '')
    const newFetchFn = (Component._Ctor.options.fetch || noopFetch).toString().replace(/\s/g, '')
    // Fetch has been updated, we call it to update the store
    if (originalFetchFn !== newFetchFn) {
      Component.options.fetch = Component._Ctor.options.fetch || noopFetch
      let p = Component.options.fetch(context)
      if (!(p instanceof Promise)) { p = Promise.resolve(p) }
      <%= (loading ? 'p.then(() => this.$loading.increase && this.$loading.increase(30))' : '') %>
      promises.push(p)
    }
    if (!promises.length) return;
    <%= (loading ? 'this.$loading.start && this.$loading.start()' : '') %>
    return Promise.all(promises).then(() => {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      _forceUpdate()
    })
  }
}

// Load vue app
const NUXT = window.__NUXT__ || {}
if (!NUXT) {
  throw new Error('[nuxt.js] cannot find the global variable __NUXT__, make sure the server is working.')
}
// Get matched components
const path = getLocation(router.options.base)
const resolveComponents = flatMapComponents(router.match(path), (Component, _, match, key, index) => {
  if (typeof Component === 'function' && !Component.options) {
    return new Promise(function (resolve, reject) {
      const _resolve = (Component) => {
        if (!Component.options) {
          Component = Vue.extend(Component) // fix issue #6
          Component._Ctor = Component
        } else {
          Component._Ctor = Component
          Component.extendOptions = Component.options
        }
        if (Component.options.data && typeof Component.options.data === 'function') {
          Component._data = Component.options.data
          if (NUXT.serverRendered) {
            Component.options.data = () => NUXT.data[index] || {}
            Component._dataFn = Component.options.data.toString().replace(/\s/g, '')
          }
          if (Component._Ctor && Component._Ctor.options) {
            Component._Ctor.options.data = Component.options.data
          }
        }
        match.components[key] = Component
        resolve(Component)
      }
      Component().then(_resolve).catch(reject)
    })
  }
  return Component
})

function nuxtReady (app) {
  window._nuxtReadyCbs.forEach((cb) => {
    if (typeof cb === 'function') {
      cb(app)
    }
  })
  // Add router hooks
  router.afterEach(function (to, from) {
    app.$nuxt.$emit('routeChanged', to, from)
  })
}

Promise.all(resolveComponents)
.then((Components) => {
  const _app = new Vue(app)
  const mountApp = () => {
    _app.$mount('#__nuxt')
    <% if (loading) { %>
    // Special loading bar
    _app.$loading = _app.$nuxt.$loading
    <% } %>
    // Hot reloading
    if (module.hot) hotReloadAPI(_app)
    // Call window.onNuxtReady callbacks
    Vue.nextTick(() => nuxtReady(_app))
  }
  <% if (store) { %>
  // Replace store state
  if (NUXT.state) {
    store.replaceState(NUXT.state)
  }
  <% } %>
  _app.setTransitions = _app.$options._nuxt.setTransitions.bind(_app)
  if (Components.length) {
    _app.setTransitions(mapTransitions(Components, router.currentRoute))
    _lastPaths = router.currentRoute.matched.map((route) => compile(route.path)(router.currentRoute.params))
  }
  _app.error = _app.$options._nuxt.error.bind(_app)
  _app.$loading = {} // to avoid error while _app.$nuxt does not exist
  if (NUXT.error) _app.error(NUXT.error)
  // Add router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))
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
    mountApp()
  })
})
.catch((err) => {
  console.error('[nuxt.js] Cannot load components', err) // eslint-disable-line no-console
})
