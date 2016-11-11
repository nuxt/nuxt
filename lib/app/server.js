'use strict'

const debug = require('debug')('nuxt:render')
import Vue from 'vue'
import { stringify } from 'querystring'
import { pick } from 'lodash'
import { app, router<%= (store ? ', store' : '') %> } from './index'
import { getMatchedComponents, getContext, urlJoin } from './utils'

const isDev = <%= isDev %>
const _app = new Vue(app)

// Fix issue from vue-router Abstract mode with base (use for server-side rendering)
router.history.base = '<%= router.base %>'

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

  <%= (isDev ? 'const s = isDev && Date.now()' : '') %>
  // Call data & fecth hooks on components matched by the route.
  let Components = getMatchedComponents(context.route)
  if (!Components.length) {
    context.nuxt.error = _app.error({ statusCode: 404, message: 'This page could not be found.', url: context.route.path })
    <%= (store ? 'context.nuxt.state = store.state' : '') %>
    return Promise.resolve(_app)
  }
  return Promise.all(Components.map((Component) => {
    let promises = []
    if (Component.data && typeof Component.data === 'function') {
      Component._data = Component.data
      var promise = Component.data(getContext(context))
      if (!(promise instanceof Promise)) promise = Promise.resolve(promise)
      promise.then((data) => {
        Component.data = () => data
      })
      promises.push(promise)
    } else {
      promises.push(null)
    }
    if (Component.fetch) {
      promises.push(Component.fetch(getContext(context)))
    }
    return Promise.all(promises)
  }))
  .then((res) => {
    <% if (isDev) { %>
      debug('Data fetching ' + context.req.url + ': ' + (Date.now() - s) + 'ms')
    <% } %>
    // datas are the first row of each
    context.nuxt.data = res.map((tab) => tab[0])
    <%= (store ? '// Add the state from the vuex store' : '') %>
    <%= (store ? 'context.nuxt.state = store.state' : '') %>
    return _app
  })
  .catch(function (error) {
    context.nuxt.error = _app.error(error)
    <%= (store ? 'context.nuxt.state = store.state' : '') %>
    return _app
  })
}
