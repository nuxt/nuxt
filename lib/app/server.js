'use strict'

const debug = require('debug')('nuxt:render')
debug.color = 4 // force blue color
import Vue from 'vue'
import { stringify } from 'querystring'
import { omit } from 'lodash'
import middleware from './middleware'
import { app, router<%= (store ? ', store' : '') %> } from './index'
import { getMatchedComponents, getContext, promiseSeries, promisify, urlJoin } from './utils'

const isDev = <%= isDev %>
const _app = new Vue(app)

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.
export default context => {
  // Add store to the context
  <%= (store ? 'context.store = store' : '') %>
  // Nuxt object
  context.nuxt = { data: [], error: null<%= (store ? ', state: null' : '') %>, serverRendered: true }
  // create context.next for simulate next() of beforeEach() when wanted to redirect
  context.redirected = false
  context.next = function (opts) {
    // if nuxt generate
    if (!context.res) {
      context.redirected = opts
      context.nuxt.serverRendered = false
      return
    }
    opts.query = stringify(opts.query)
    opts.path = opts.path + (opts.query ? '?' + opts.query : '')
    opts.path = urlJoin('<%= router.base %>', opts.path)
    context.res.writeHead(opts.status, {
      'Location': opts.path
    })
    context.res.end()
  }
  // set router's location
  router.push(context.url)
  // Add route to the context
  context.route = router.currentRoute
  // Add meta infos
  context.meta = _app.$meta()
  // Error function
  context.error = _app.$options._nuxt.error.bind(_app)

  <%= (isDev ? 'const s = isDev && Date.now()' : '') %>
  const ctx = getContext(context)
  let Components = getMatchedComponents(context.route)
  <% if (store) { %>
    let promise = (store._actions && store._actions.nuxtServerInit ? store.dispatch('nuxtServerInit', omit(getContext(context), 'redirect', 'error')) : null)
    if (!(promise instanceof Promise)) promise = Promise.resolve()
  <% } else { %>
    let promise = Promise.resolve()
  <% } %>
  return promise
  .then(() => {
    // Sanitize Components
    Components = Components.map((Component) => {
      let promises = []
      if (!Component.options) {
        Component = Vue.extend(Component)
        Component._Ctor = Component
      } else {
        Component._Ctor = Component
        Component.extendOptions = Component.options
      }
      return Component
    })
    // Set layout
    return _app.setLayout(Components.length ? Components[0].options.layout : '')
  })
  .then((layout) => {
    // Call middleware
    let midd = <%= serialize(router.middleware, { isJSON: true }) %>
    if (layout.middleware) {
      midd = midd.concat(layout.middleware)
    }
    Components.forEach((Component) => {
      if (Component.options.middleware) {
        midd = midd.concat(Component.options.middleware)
      }
    })
    midd = midd.map((name) => {
      if (typeof middleware[name] !== 'function') {
        context.nuxt.error = context.error({ statusCode: 500, message: 'Unknown middleware ' + name })
      }
      return middleware[name]
    })
    if (context.nuxt.error) return
    return promiseSeries(midd, ctx)
  })
  .then(() => {
    // Call .validate()
    let isValid = true
    Components.forEach((Component) => {
      if (!isValid) return
      if (typeof Component.options.validate !== 'function') return
      isValid = Component.options.validate({
        params: context.route.params || {},
        query: context.route.query || {}
      })
    })
    if (!isValid) {
      // Don't server-render the page in generate mode
      if (context._generate) {
        context.nuxt.serverRendered = false
      }
      // Call the 404 error by making the Components array empty
      Components = []
      return _app
    }
    // Call data & fetch hooks on components matched by the route.
    return Promise.all(Components.map((Component) => {
      let promises = []
      if (Component.options.data && typeof Component.options.data === 'function') {
        Component._data = Component.options.data
        let promise = promisify(Component._data, ctx)
        promise.then((data) => {
          Component.options.data = () => data
          Component._Ctor.options.data = Component.options.data
        })
        promises.push(promise)
      } else {
        promises.push(null)
      }
      if (Component.options.fetch) {
        promises.push(Component.options.fetch(ctx))
      }
      return Promise.all(promises)
    }))
  })
  .then((res) => {
    if (!Components.length) {
      context.nuxt.error = context.error({ statusCode: 404, message: 'This page could not be found.' })
      <%= (store ? 'context.nuxt.state = store.state' : '') %>
      return _app
    }
    <% if (isDev) { %>
      debug('Data fetching ' + context.req.url + ': ' + (Date.now() - s) + 'ms')
    <% } %>
    // datas are the first row of each
    context.nuxt.data = res.map((tab) => tab[0])
    context.nuxt.error = _app.$options._nuxt.err
    <%= (store ? '// Add the state from the vuex store' : '') %>
    <%= (store ? 'context.nuxt.state = store.state' : '') %>
    return _app
  })
  .catch(function (error) {
    if (error && (error instanceof Error || error.constructor.toString().indexOf('Error()') !== -1)) {
      let statusCode = error.statusCode || error.status || (error.response && error.response.status) || 500
      error = { statusCode, message: error.message }
    }
    else if (typeof error === 'string') {
      error = { statusCode: 500, message: error }
    }
    context.nuxt.error = context.error(error)
    <%= (store ? 'context.nuxt.state = store.state' : '') %>
    return _app
  })
}
