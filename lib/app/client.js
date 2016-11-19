'use strict'

require('es6-object-assign').polyfill()
import 'es6-promise/auto'
import Vue from 'vue'
import { app, router<%= (store ? ', store' : '') %> } from './index'
import { getMatchedComponents, flatMapComponents, getContext, promisify, getLocation } from './utils'
const noopData = () => { return {} }
const noopFetch = () => {}

function loadAsyncComponents (to, ___, next) {
  const resolveComponents = flatMapComponents(to, (Component, _, match, key) => {
    if (typeof Component === 'function' && !Component.options) {
      return new Promise(function (resolve, reject) {
        const _resolve = (Component) => {
          // console.log('Component loaded', Component, match.path, key)
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

function render (to, ___, next) {
  let Components = getMatchedComponents(to)
  if (!Components.length) {
    this.error({ statusCode: 404, message: 'This page could not be found.', url: to.path })
    return next()
  }
  // console.log('Load components', Components, to.path)
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
  this.error()
  let nextCalled = false
  Promise.all(Components.map((Component) => {
    let promises = []
    const _next = function (path) {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      nextCalled = true
      next(path)
    }
    const context = getContext({ to<%= (store ? ', store' : '') %>, isClient: true, next: _next.bind(this), error: this.error.bind(this) })
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
    <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
    // If not redirected
    if (!nextCalled) {
      next()
    }
  })
  .catch((error) => {
    this.error(error)
    next(false)
  })
}

// Special hot reload with data(context)
function hotReloadAPI (_app) {
  var _forceUpdate = _app.$forceUpdate.bind(_app)
  _app.$forceUpdate = function () {
    let Component = getMatchedComponents(router.currentRoute)[0]
    if (!Component) return _forceUpdate()
    if (typeof Component === 'object' && !Component.options) {
      // Updated via vue-router resolveAsyncComponents()
      Component = Vue.extend(Component)
      Component._Ctor = Component
    }
    <%= (loading ? 'this.$loading.start && this.$loading.start()' : '') %>
    let promises = []
    const next = function (path) {
      <%= (loading ? 'this.$loading.finish && this.$loading.finish()' : '') %>
      router.push(path)
    }
    const context = getContext({ route: router.currentRoute<%= (store ? ', store' : '') %>, isClient: true, next: next.bind(this), error: _app.error.bind(_app) })
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
<% if (store) { %>
// Replace store state
if (NUXT.state) {
  store.replaceState(NUXT.state)
}
<% } %>
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

Promise.all(resolveComponents)
.then((Components) => {
  const _app = new Vue(app)
  const mountApp = () => _app.$mount('#__nuxt')
  const onNuxtReady = window.onNuxtReady || function () {}
  if (NUXT.error) _app.error(NUXT.error)
  if (module.hot) hotReloadAPI(_app)
  // Add router hooks
  router.beforeEach(loadAsyncComponents.bind(_app))
  router.beforeEach(render.bind(_app))
  if (NUXT.serverRendered) {
    mountApp()
    // Call window.onModulesLoaded for jsdom testing (https://github.com/tmpvar/jsdom#dealing-with-asynchronous-script-loading)
    onNuxtReady(_app)
    return
  }
  render.call(_app, router.currentRoute, router.currentRoute, function (path) {
    if (path) {
      let mounted = false
      router.afterEach(function () {
        if (mounted) return
        mounted = true
        mountApp()
        onNuxtReady(_app)
      })
      router.push(path)
      return
    }
    mountApp()
    onNuxtReady(_app)
  })
})
.catch((err) => {
  console.error('[nuxt.js] Cannot load components', err)
})
