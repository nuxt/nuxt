import Vue from 'vue'
import clone from 'clone'
import { stringify } from 'querystring'
import { omit } from 'lodash'
import middleware from './middleware'
import { createApp, NuxtError } from './index'
import { applyAsyncData, sanitizeComponent, getMatchedComponents, getContext, middlewareSeries, promisify, urlJoin } from './utils'

const debug = require('debug')('nuxt:render')
debug.color = 4 // force blue color

const isDev = <%= isDev %>

const noopApp = () => new Vue({ render: (h) => h('div') })

const createNext = context => opts => {
  context.redirected = opts
  // If nuxt generate
  if (!context.res) {
    context.nuxt.serverRendered = false
    return
  }
  opts.query = stringify(opts.query)
  opts.path = opts.path + (opts.query ? '?' + opts.query : '')
  if (opts.path.indexOf('http') !== 0 && ('<%= router.base %>' !== '/' && opts.path.indexOf('<%= router.base %>') !== 0)) {
    opts.path = urlJoin('<%= router.base %>', opts.path)
  }
  // Avoid loop redirect
  if (opts.path === context.url) {
    context.redirected = false
    return
  }
  context.res.writeHead(opts.status, {
    'Location': opts.path
  })
  context.res.end()
}

// This exported function will be called by `bundleRenderer`.
// This is where we perform data-prefetching to determine the
// state of our application before actually rendering it.
// Since data fetching is async, this function is expected to
// return a Promise that resolves to the app instance.
export default async context => {
  // Create context.next for simulate next() of beforeEach() when wanted to redirect
  context.redirected = false
  context.next = createNext(context)
  context.beforeRenderFns = []

  const { app, router<%= (store ? ', store' : '') %> } = await createApp(context)
  const _app = new Vue(app)

  <% if (store) { %>
  // Add store to the context
  context.store = store
  <% } %>

  // Add route to the context
  context.route = router.currentRoute

  // Nuxt object
  context.nuxt = { layout: 'default', data: [], error: null<%= (store ? ', state: null' : '') %>, serverRendered: true }

  // Add meta infos
  context.meta = _app.$meta()

  // Error function
  context.error = _app.$options._nuxt.error.bind(_app)

  // Keep asyncData for each matched component in context
  context.asyncData = {}

  // Create shared ctx
  const ctx = getContext(context, app)

  <% if (isDev) { %>const s = isDev && Date.now()<% } %>

  // Resolve components
  let Components = []
  try {
    Components = await Promise.all(getMatchedComponents(router.match(context.url)).map(Component => {
      if (typeof Component !== 'function' || Component.super === Vue) {
        return sanitizeComponent(Component)
      }
      return Component().then(Component => sanitizeComponent(Component))
    }))
  } catch (err) {
    // Throw back error to renderRoute()
    throw err
  }

  <% if (store) { %>
  // Dispatch store nuxtServerInit
  if (store._actions && store._actions.nuxtServerInit) {
    await store.dispatch('nuxtServerInit', ctx)
  }
  // ...If there is a redirect
  if (context.redirected) return noopApp()
  <% } %>

  // Call global middleware (nuxt.config.js)
  let midd = <%= serialize(router.middleware, { isJSON: true }) %>
  midd = midd.map((name) => {
    if (typeof middleware[name] !== 'function') {
      context.nuxt.error = context.error({ statusCode: 500, message: 'Unknown middleware ' + name })
    }
    return middleware[name]
  })
  if (!context.nuxt.error) {
    await middlewareSeries(midd, ctx)
  }
  // ...If there is a redirect
  if (context.redirected) return noopApp()

  // Set layout
  let layout = Components.length ? Components[0].options.layout : NuxtError.layout
  if (typeof layout === 'function') layout = layout(ctx)
  await _app.loadLayout(layout)
  layout = _app.setLayout(layout)
  // ...Set layout to __NUXT__
  context.nuxt.layout = _app.layoutName

  // Call middleware (layout + pages)
  if (!context.nuxt.error) {
    midd = []
    if (layout.middleware) midd = midd.concat(layout.middleware)
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

    await middlewareSeries(midd, ctx)

    // If there is a redirect
    if (context.redirected) return noopApp()
  }

  // Call .validate()
  let isValid = true
  Components.forEach((Component) => {
    if (!isValid) return
    if (typeof Component.options.validate !== 'function') return
    isValid = Component.options.validate({
      params: context.route.params || {},
      query: context.route.query  || {},
      <%= (store ? 'store: ctx.store' : '') %>
    })
  })
  // ...If .validate() returned false
  if (!isValid) {
    // Don't server-render the page in generate mode
    if (context._generate) {
      context.nuxt.serverRendered = false
    }
    // Call the 404 error by making the Components array empty
    Components = []
  }

  // Call asyncData & fetch hooks on components matched by the route.
  let asyncDatas = await Promise.all(Components.map(Component => {
    let promises = []

    // Call asyncData(context)
    if (Component.options.asyncData && typeof Component.options.asyncData === 'function') {
      let promise = promisify(Component.options.asyncData, ctx)
      promise.then(asyncDataResult => {
        context.asyncData[Component.options.name] = asyncDataResult
        applyAsyncData(Component)
        return asyncDataResult
      })
      promises.push(promise)
    } else {
      promises.push(null)
    }

    // Call fetch(context)
    if (Component.options.fetch) {
      promises.push(Component.options.fetch(ctx))
    }
    else {
      promises.push(null)
    }

    return Promise.all(promises)
  }))

  // If no Components found, returns 404
  if (!Components.length) {
    context.nuxt.error = context.error({ statusCode: 404, message: 'This page could not be found.' })
  }

  <% if (isDev) { %>if (asyncDatas.length) debug('Data fetching ' + context.url + ': ' + (Date.now() - s) + 'ms')<% } %>

  // datas are the first row of each
  context.nuxt.data = asyncDatas.map(r => r[0] || {})

  // If an error occured in the execution
  if (_app.$options._nuxt.err) {
    context.nuxt.error = _app.$options._nuxt.err
  }

  <% if (store) { %>
  // Add the state from the vuex store
  context.nuxt.state = store.state
  <% } %>

  await Promise.all(context.beforeRenderFns.map((fn) => promisify(fn, { Components, nuxtState: context.nuxt })))

  // If no error, return main app
  if (!context.nuxt.error) {
    return _app
  }

  // Load layout for error page
  layout = (typeof NuxtError.layout === 'function' ? NuxtError.layout(ctx) : NuxtError.layout)
  context.nuxt.layout = layout || ''
  await _app.loadLayout(layout)
  _app.setLayout(layout)

  return _app
}
